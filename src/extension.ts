import * as path from 'path'
import * as net from 'net';
import * as child_process from 'child_process';
import * as portfinder from 'portfinder';
import {
    window as Window, ExtensionContext, TextDocument, WorkspaceFolder, Uri, window, InputBoxOptions, workspace, ConfigurationScope, commands, ConfigurationChangeEvent, OpenDialogOptions
} from 'vscode';
import {
    LanguageClientOptions, ServerOptions
} from 'vscode-languageclient';
import { SpecificationLanguageClient } from "./SpecificationLanguageClient"
import * as Util from "./Util"
import { VdmDapSupport as dapSupport } from "./VdmDapSupport"
import { CTHandler } from './CTHandler';
import { VdmjCTFilterHandler } from './VdmjCTFilterHandler';
import { VdmjCTInterpreterHandler } from './VdmjCTInterpreterHandler';
import { TranslateHandler } from './TranslateHandler';
import * as fs from 'fs';

globalThis.clients = new Map();
let ctHandler: CTHandler;
let translateHandlerLatex: TranslateHandler;
let translateHandlerWord: TranslateHandler;

let _sortedWorkspaceFolders: string[] | undefined;
function sortedWorkspaceFolders(): string[] {
    if (_sortedWorkspaceFolders === void 0) {
        _sortedWorkspaceFolders = workspace.workspaceFolders ? workspace.workspaceFolders.map(folder => {
            let result = folder.uri.toString();
            if (result.charAt(result.length - 1) !== '/') {
                result = result + '/';
            }
            return result;
        }).sort(
            (a, b) => {
                return a.length - b.length;
            }
        ) : [];
    }
    return _sortedWorkspaceFolders;
}
workspace.onDidChangeWorkspaceFolders(() => _sortedWorkspaceFolders = undefined);

function getOuterMostWorkspaceFolder(folder: WorkspaceFolder): WorkspaceFolder {
    const sorted = sortedWorkspaceFolders();
    for (const element of sorted) {
        let uri = folder.uri.toString();
        if (uri.charAt(uri.length - 1) !== '/') {
            uri = uri + '/';
        }
        if (uri.startsWith(element)) {
            return workspace.getWorkspaceFolder(Uri.parse(element))!;
        }
    }
    return folder;
}

function getDialect(document: TextDocument): string {
    return document.languageId;
}

function didChangeConfiguration(event: ConfigurationChangeEvent, folder: WorkspaceFolder){
    if (event.affectsConfiguration("vdm-vscode", folder)){
        window.showInformationMessage("Configurations changed. Please reload VS Code to enable it.", "Reload Now").then(res => {
            if (res == "Reload Now") 
                commands.executeCommand("workbench.action.reloadWindow");
        })
    }
}

export function activate(context: ExtensionContext) {
    let vdmjPath = Util.recursivePathSearch(path.resolve(context.extensionPath, "resources", "jars"), /vdmj.*jar/i);
    let lspServerPath = Util.recursivePathSearch(path.resolve(context.extensionPath, "resources", "jars"), /lsp.*jar/i);
    let annotationsPath = Util.recursivePathSearch(path.resolve(context.extensionPath, "resources", "jars"), /annotations.*jar/i);
    let vdmjPath_hp = Util.recursivePathSearch(path.resolve(context.extensionPath, "resources", "jars_highPrecision"), /vdmj.*jar/i);
    let lspServerPath_hp = Util.recursivePathSearch(path.resolve(context.extensionPath, "resources", "jars_highPrecision"), /lsp.*jar/i);
    let annotationsPath_hp = Util.recursivePathSearch(path.resolve(context.extensionPath, "resources", "jars_highPrecision"), /annotations.*jar/i);
    let extensionLogPath = path.resolve(context.logUri.fsPath, "vdm-vscode.log");

    // Ensure logging path exists
    Util.ensureDirectoryExistence(extensionLogPath);

    if (!vdmjPath || !lspServerPath || !annotationsPath)
        return;

    function didOpenTextDocument(document: TextDocument): void {
        // We are only interested in vdm text
        if (document.languageId !== 'vdmsl' && document.languageId !== 'vdmpp' && document.languageId !== 'vdmrt') {
            return;
        }

        const uri = document.uri;
        let folder = workspace.getWorkspaceFolder(uri);
        // Files outside a folder can't be handled. 
        if (!folder) { // TODO remove if we get support for single file workspace
            return;
        }
        // If we have nested workspace folders we only start a server on the outer most workspace folder.
        folder = getOuterMostWorkspaceFolder(folder);

        // If a client has not been started for the folder, start one
        if (!globalThis.clients.has(folder.uri.toString())) {
            globalThis.clients.set(folder.uri.toString(), null);
            let dialect = getDialect(document);

            launchClient(dialect, folder);
        }
    }

    async function launchClient(dialect: string, folder: WorkspaceFolder): Promise<void> {
        let serverMainClass = 'lsp.LSPServerSocket';

        // Add settings watch for workspace folder
        workspace.onDidChangeConfiguration(e => didChangeConfiguration(e, folder));

        // If using experimental server
        let debug = workspace.getConfiguration('vdm-vscode.debug', folder).experimentalServer;
        if (debug) {
            let lspPort = workspace.getConfiguration('vdm-vscode.debug', folder).lspPort;
            let dapPort = workspace.getConfiguration('vdm-vscode.debug', folder).dapPort;
            window.showInformationMessage(`Connecting to experimental server on LSP port ${lspPort} and DAP port ${dapPort}`);

            let client = createClient(dialect, lspPort, dapPort, folder);
            let clientKey = folder.uri.toString();
            globalThis.clients.set(clientKey, client);
            return;
        }

        // Get two available ports, start the server and create the client
        portfinder.getPorts(2, { host: undefined, startPort: undefined, port: undefined, stopPort: undefined }, async (err, ports) => {
            if (err) {
                Window.showErrorMessage("An error occured when finding free ports: " + err)
                Util.writeToLog(extensionLogPath, "An error occured when finding free ports: " + err);
                globalThis.clients.delete(folder.uri.toString());
                return;
            }
            let lspPort = ports[0];
            let dapPort = ports[1];

            // Setup server arguments
            let args: string[] = [];
            let JVMArguments = workspace.getConfiguration('vdm-vscode', folder).JVMArguments;
            if (JVMArguments != "")
                args.push(JVMArguments);

            let activateServerLog = workspace.getConfiguration('vdm-vscode.debug', folder).activateServerLog;
            if (activateServerLog){
                // Ensure logging path exists
                let languageServerLoggingPath = path.resolve(context.logUri.fsPath, folder.name.toString() + '_lang_server.log');
                Util.ensureDirectoryExistence(languageServerLoggingPath);
                
                args.push('-Dlog.filename=' + path.resolve(context.logUri.fsPath, folder.name.toString() + '_lang_server.log'));
            }

            let classPath = "";
            let useHighprecision = workspace.getConfiguration('vdm-vscode', folder).highPrecision;
            if(useHighprecision && useHighprecision === true){
                classPath += vdmjPath_hp + path.delimiter + lspServerPath_hp;
            }
            else{
                classPath += vdmjPath + path.delimiter + lspServerPath;
            }

            let userProvidedAnnotationPaths = workspace.getConfiguration('vdm-vscode', folder).annotationPaths;
            if(userProvidedAnnotationPaths){
                let jarPaths = userProvidedAnnotationPaths.split(",");
                jarPaths.forEach(jarPath => {
                    if(!fs.existsSync(jarPath)){
                        Util.writeToLog(extensionLogPath, "Invalid path: " + jarPath);
                        return;
                    }
                    
                    if(Util.isDir(jarPath)){
                        let subJarPaths = Util.getJarsFromFolder(jarPath);
                        if(subJarPaths.length === 0){
                            Util.writeToLog(extensionLogPath, "No annotations found in path: " + jarPath);
                        }
                        subJarPaths.forEach(subJarPath =>{
                            classPath +=  path.delimiter + subJarPath;
                        })
                    }
                    else if(jarPath.split(jarPath.sep)[jarPath.split(jarPath.sep).length -1].search(/.*jar/i) != -1){
                        classPath +=  path.delimiter + jarPath;
                    }
                    else{
                        Util.writeToLog(extensionLogPath, "Invalid path to annotation: " + jarPath);
                    }
                });          
            }

            if(useHighprecision && useHighprecision === true){
                classPath += path.delimiter + annotationsPath_hp;
            }
            else{
                classPath += path.delimiter + annotationsPath;
            }

            args.push(...[
                '-cp', classPath,
                serverMainClass,
                '-' + dialect,
                '-lsp', lspPort.toString(), '-dap', dapPort.toString()
            ]);

            // Start the LSP server
            let javaPath = Util.findJavaExecutable('java');
            if (!javaPath) {
                Window.showErrorMessage("Java runtime environment not found!")
                Util.writeToLog(extensionLogPath, "Java runtime environment not found!");
                globalThis.clients.delete(folder.uri.toString());
                return;
            }
            child_process.spawn(javaPath, args);

            // Wait for the server to be ready
            let connected = false;
            let timeOutCounter = 0;
            while (!connected) {
                var sock = net.connect(lspPort, 'localhost', () => {
                    sock.destroy();
                    connected = true;
                });
                await new Promise(resolve => sock.once("close", () => setTimeout(resolve, 25)))
                if (timeOutCounter++ == 100) {
                    Window.showErrorMessage("ERROR: LSP server connection timeout");
                    Util.writeToLog(extensionLogPath, "ERROR: LSP server connection timeout");
                    globalThis.clients.delete(folder.uri.toString());
                    return;
                }
            }

            let client = createClient(dialect, lspPort, dapPort, folder);

            // It is assumed that the last part of the uri is the name of the specification. This logic is used in the ctHandler.
            let clientKey = folder.uri.toString();

            // Save client
            globalThis.clients.set(clientKey, client);
        });
    }

    function createClient(dialect: string, lspPort: number, dapPort: number, folder: WorkspaceFolder): SpecificationLanguageClient {
        // Setup DAP
        dapSupport.initDebugConfig(context, folder, dapPort)

        // Setup server options
        let serverOptions: ServerOptions = () => {
            // Create socket connection
            let socket = net.connect({ port: lspPort });
            return Promise.resolve({
                writer: socket,
                reader: socket
            });
        };

        // Setup client options
        let clientOptions: LanguageClientOptions = {
            // Document selector defines which files from the workspace, that is also open in the client, to monitor.
            documentSelector: [{ scheme: 'file', language: dialect, pattern: `${folder.uri.fsPath}/**/*`}],
            diagnosticCollectionName: "vdm-vscode",
            workspaceFolder: folder
        }

        // Create the language client with the defined client options and the function to create and setup the server.
        let client = new SpecificationLanguageClient(
            `vdm-vscode_${folder.name}_client`,
            `${folder.name}_client`,
            serverOptions,
            clientOptions,
            context,
            Uri.joinPath(folder.uri, ".generated")
        );

        // Start the and launch the client
        let disposable = client.start();

        // Push the disposable to the context's subscriptions so that the client can be deactivated on extension deactivation
        context.subscriptions.push(disposable);

        return client;
    }

    ctHandler = new CTHandler(globalThis.clients, context, new VdmjCTFilterHandler(), new VdmjCTInterpreterHandler(), true)
    translateHandlerLatex = new TranslateHandler(globalThis.clients, context, SpecificationLanguageClient.latexLanguageId, "vdm-vscode.translateLatex");
    translateHandlerWord = new TranslateHandler(globalThis.clients, context, SpecificationLanguageClient.wordLanguageId, "vdm-vscode.translateWord");

    workspace.onDidOpenTextDocument(didOpenTextDocument);
    workspace.textDocuments.forEach(didOpenTextDocument);
    workspace.onDidChangeWorkspaceFolders((event) => {
        for (const folder of event.removed) {
            const client = globalThis.clients.get(folder.uri.toString());
            if (client) {
                globalThis.clients.delete(folder.uri.toString());
                client.stop();
            }
        }
    });

    commands.registerCommand("vdm-vscode.importProject", () => {
        let options : OpenDialogOptions = {
            title: "Select example projects to import",
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: true,
            defaultUri: Uri.joinPath(context.extensionUri, "example_projects"),
        }
        window.showOpenDialog(options).then(folders => {
            // Canceled
            if (folders === undefined)
                return;

            // Check if folder is part of example project folder
            let validUris = true;
            folders.forEach(uri => {
                let validUri = false;
                [Uri.joinPath(context.extensionUri, "example_projects", "VDM++","x").toString(),
                Uri.joinPath(context.extensionUri, "example_projects", "VDMSL","x").toString(),
                Uri.joinPath(context.extensionUri, "example_projects", "VDMRT","x").toString()].forEach(v => {
                    if (uri.toString().startsWith(v.slice(0,v.length-1)))
                        validUri = true;
                })
                if (!validUri)
                    validUris = false;
            })
            if (!validUris){
                window.showInformationMessage("Selected folder is not an example project");
                return
            }
                
            // In a workspace
            let asd = workspace.workspaceFile
            if ( asd === undefined)
                window.showInformationMessage("no workspace");

            // workspace.updateWorkspaceFolders{workspace.workspaceFolders ? workspace.workspaceFolders.length : 0, null, {uri: }}
        })
    })
}

export function deactivate(): Thenable<void> | undefined {
    let promises: Thenable<void>[] = [];
    for (let client of globalThis.clients.values()) {
        promises.push(client.stop());
    }
    return Promise.all(promises).then(() => undefined);
}
