import { clearInterval } from "timers";
import { ExtensionContext, Uri, window, commands, workspace } from "vscode";
import { StaticFeature, ClientCapabilities, ServerCapabilities, Event } from "vscode-languageclient";
import { ProofObligationPanel } from "./ProofObligationPanel";
import { ExperimentalCapabilities, POGUpdatedNotification, GeneratePOParams, GeneratePORequest } from "./protocol.slsp";
import { SpecificationLanguageClient } from "./SpecificationLanguageClient";

export class ProofObligationGenerationFeature implements StaticFeature {
    private static commandRegistered = false;
    private _client: SpecificationLanguageClient;
    private _context: ExtensionContext;

    constructor(client: SpecificationLanguageClient, context: ExtensionContext) {
        this._client = client;
        this._context = context;   
    }

    fillClientCapabilities(capabilities: ClientCapabilities): void {
        // Client supports POG
        if(!capabilities.experimental)
            capabilities.experimental = { proofObligationGeneration: true };
        else
            Object.assign(capabilities.experimental, {proofObligationGeneration: true});
    }

    initialize(capabilities: ServerCapabilities<ExperimentalCapabilities>): void {
        // If server supports POG
        if (capabilities?.experimental?.proofObligationProvider) {
            this.registerPOGCommand();
            this.registerPOGUpdatedNotificationHandler();
        }
    }

    private registerCommand = (command: string, callback: (...args: any[]) => any) => {
        let disposable = commands.registerCommand(command, callback)
        this._context.subscriptions.push(disposable);
        return disposable;
    };

    private registerPOGCommand(): void {
        if (!ProofObligationGenerationFeature.commandRegistered) {
            ProofObligationGenerationFeature.commandRegistered = true;
            commands.executeCommand( "setContext", "pog-show-button", true );
            this.registerCommand("vdm-vscode.runPOG", (inputUri: Uri) => {

                // Find client
                let wsFolder = workspace.getWorkspaceFolder(inputUri);
                let client = globalThis.clients.get(wsFolder.uri.toString());

                // If no client -> Launch client and re-execute command 
                if (!client){
                    commands.executeCommand("vscode.open",inputUri).then(e => {
                        function awaitClient(times: number) {
                            if (times == 0)
                                return;

                            setTimeout(e => {
                                let client : SpecificationLanguageClient = globalThis.clients.get(wsFolder.uri.toString())
                                if (client && client.initializeResult) {
                                    commands.executeCommand("vdm-vscode.runPOG",inputUri)
                                }
                                else
                                    awaitClient(times - 1);
                            },100)
                        }
                        awaitClient(50); // 5 second maximum
                    })
                    return;
                }

                ProofObligationGenerationFeature.run(wsFolder.uri, client, this._context)
            });
        }
    }

    private registerPOGUpdatedNotificationHandler(): void {
        this._client.onNotification(POGUpdatedNotification.type, (params) => {
            // Only perform actions if POG View exists and if active editor is on a file from the clients workspace
            if (ProofObligationPanel.currentPanel &&
                (workspace.getWorkspaceFolder(window.activeTextEditor.document.uri).uri.toString() == this._client.clientOptions.workspaceFolder.uri.toString()) ) {
                // If POG is possible
                if (params.successful) {
                    // Request new POG 
                    ProofObligationGenerationFeature.run(this._client.clientOptions.workspaceFolder.uri, this._client, this._context, false);
                }
                else {
                    // Display warning that POs may be outdated
                    ProofObligationPanel.displayWarning();
                }
            }
        });
    }

    static async run(inputUri: Uri, client: SpecificationLanguageClient, context: ExtensionContext, revealPOGView: boolean = true) {
        window.setStatusBarMessage("Running Proof Obligation Generation", 2000);

        try {
            // Setup message parameters
            let params: GeneratePOParams = {
                uri: inputUri.toString(),
            };

            // Send request
            const pos = await client.sendRequest(GeneratePORequest.type, params);

            // Create new view or show existing POG View
            let workspaceName = (workspace.workspaceFolders.length > 1 ? workspace.getWorkspaceFolder(inputUri).name : undefined)
            ProofObligationPanel.createOrShowPanel(Uri.file(context.extensionPath), revealPOGView, workspaceName);
            ProofObligationPanel.currentPanel.displayNewPOS(pos);
        }
        catch (error) {
            window.showInformationMessage("Proof obligation generation failed. " + error);
        }
    }   
}