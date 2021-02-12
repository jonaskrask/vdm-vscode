import * as vscode from 'vscode';
import { commands, ExtensionContext, Uri, window, WorkspaceFolder} from "vscode";
import { CancellationTokenSource,ErrorCodes, WorkDoneProgress} from "vscode-languageclient";
import { CTTestCase, CTSymbol, CTFilterOption, CTTracesParameters, CTTracesRequest, CTGenerateParameters, CTGenerateRequest, CTExecuteParameters, CTExecuteRequest, NumberRange} from "./protocol.slsp";
import { SpecificationLanguageClient } from "./SpecificationLanguageClient";
import { CTTreeView } from './CTTreeView';
import * as util from "./Util"

export class CTHandler {
    private _ctTreeView : CTTreeView;
    private _cancelToken: CancellationTokenSource;
    private _generateCalls : number = 0;
    private _progress: number = 0;
    public currentClient: SpecificationLanguageClient;
    public currentClientName: string;

    constructor(
        private _clients: Map<string, SpecificationLanguageClient>,
        private _context: ExtensionContext, 
        private _filterHandler?: CTFilterHandler, 
        private _interpreterHandler?: CTInterpreterHandler,
        private _supportWorkDone = false) {
            // Set filter
            if (this._filterHandler)
                this.registerCommand("vdm-vscode.ctSetFilter", () => this._filterHandler.setCTFilter());
             
            // Register view
            this._ctTreeView = new CTTreeView(this, this._context, !!this._filterHandler);

            this.registerCommand("vdm-vscode.ctCancel", () => this.cancelExecution());
        }
    
    private registerCommand = (command: string, callback: (...args: any[]) => any) => {
        let disposable = commands.registerCommand(command, callback)
        this._context.subscriptions.push(disposable);
        return disposable;
    };

    private async clientReady(uri: Uri, times: number) {
        return new Promise<void>((resolve, reject) => {
            if (times == 0)
                reject();

            setTimeout(e => {
                let client: SpecificationLanguageClient = globalThis.clients.get(uri.toString())
                if (client && client.initializeResult) {
                    resolve()
                }
                else
                    this.clientReady(uri, times - 1);
            }, 100)
        })
    }

    public async showAvailableSpecsForCT(): Promise<boolean> {
        // Skip if only one client available
        if (vscode.workspace.workspaceFolders.length == 1){

            this.setCurrentClientFromKey(vscode.workspace.workspaceFolders.values().next().value)
            return;
        }

        let showOptions: string[] = [];
        vscode.workspace.workspaceFolders.forEach((v,k) => {
            showOptions.push(v.name);
        });
        showOptions.push("> Cancel");

        let success = true
        await vscode.window.showQuickPick(showOptions).then(res => {
            if (res == undefined || res == "> Cancel") {  // Exit on 'esc' or 'Cancel'
                success = false;
                return;
            }

            this.setCurrentClientFromKey(Array.from(this._clients.keys()).find(k => Uri.parse(k).fsPath.includes(res)));
        })
        return success;
    }

    private setCurrentClientFromKey(clientKey: string){
        // If client is NOT running
        if (!this._clients.get(clientKey)){
            
        }

        this.currentClient = this._clients.get(clientKey);
        this.currentClientName = this.currentClient.clientOptions.workspaceFolder.name;
    }

    public async requestTraces(uri?: Uri) : Promise<CTSymbol[]>{
        let barMessage = window.setStatusBarMessage('Requesting Combinatorial Test Trace Overview');

        try {
            // Setup message parameters
            let params: CTTracesParameters = {};
            if (uri)
                params.uri = uri.toString();

            // Send request
            const symbols = await this.currentClient.sendRequest(CTTracesRequest.type, params);
            barMessage.dispose();
            return symbols;
        }
        catch (err) {
            window.showWarningMessage("Combinatorial Test - trace request failed. " + err);
            barMessage.dispose();
            return null;
        }
    }

    public async requestGenerate(name: string) : Promise<number> {
        try {
            // Setup message parameters
            let params: CTGenerateParameters = {name: name};

            // Send request
            const res = await this.currentClient.sendRequest(CTGenerateRequest.type, params);
            return res.numberOfTests;
        }
        catch (err) {
            util.writeToLog(this.currentClient.logPath, "CT - generation request failed: " + err);
            throw err;
        }
    }

    public async requestExecute(name: string, filtered: boolean = false, range?: NumberRange, progress?: vscode.Progress<{ message?: string; increment?: number }>){
        // Check if already running an execution
        if (this._cancelToken){
            window.showInformationMessage("Combinatorial Test - execute request failed: An execution is already running");
            return;
        }

        // Generate cancel token
        this._cancelToken = new CancellationTokenSource();
        this._context.subscriptions.push(this._cancelToken);

        try {
            // Setup message parameters
            let params: CTExecuteParameters = {name: name};
            if (filtered){
                params.filter = await this._filterHandler.getCTFilter();
            }
            if (range)
                params.range = range;

            // Setup partial result handler
            let partialResultToken = this.generateToken();
            params.partialResultToken = partialResultToken
            var partialResultHandlerDisposable = this.currentClient.onProgress(CTExecuteRequest.resultType, partialResultToken, (tests) => this.handleExecutePartialResult(tests, name));

            // Setup work done  progress handler
            if (this._supportWorkDone && progress != undefined){
                this._progress = 0;
                let workDoneTokenToken = this.generateToken();
                params.workDoneToken = workDoneTokenToken;
                var workDoneProgressHandlerDisposable = this.currentClient.onProgress(WorkDoneProgress.type, workDoneTokenToken, (value) => this.handleExecuteWorkDoneProgress(value, progress));
            }

            // Send request
            const tests = await this.currentClient.sendRequest(CTExecuteRequest.type, params, this._cancelToken.token);

            // If not using progress token, update test results
            if (tests != null)
                this._ctTreeView.addNewTestResults(name, tests)
        }
        catch (err) {
            if (err?.code == ErrorCodes.RequestCancelled){
                if (err?.data != null)
                    this._ctTreeView.addNewTestResults(name, err.data);
            }
            else
                util.writeToLog(this.currentClient.logPath, "CT - execute request failed: " + err);
            throw err;
        }
        finally{
            // Clean-up
            this._cancelToken.dispose();
            this._cancelToken = undefined;
            partialResultHandlerDisposable?.dispose();
            workDoneProgressHandlerDisposable?.dispose();
        }
    } 

    cancelExecution(){
        this._cancelToken?.cancel();
    }

    sendToInterpreter(trace: string, test:number){
        this._interpreterHandler.sendToInterpreter(trace,test,this.currentClient.clientOptions.workspaceFolder);
    }

    private handleExecutePartialResult(tests: CTTestCase[], trace: string){
        if (tests)
            this._ctTreeView.addNewTestResults(trace, tests);
        else
            window.showInformationMessage("CT Received Progress without any tests");
    }

    private handleExecuteWorkDoneProgress(value: any, progress: vscode.Progress<{ message?: string; increment?: number }>){
        if (value?.percentage != undefined){
            progress.report({message: `${value.message} - ${value.percentage}%`, increment: (value.percentage - this._progress)})
            this._progress = value.percentage
        }           
    }

    private generateToken() : string {
        return "CombinatorialTestToken-"+Date.now().toString()+(this._generateCalls++).toString();
    }
}

export interface CTFilterHandler {
    setCTFilter(): void;
    getCTFilter(): CTFilterOption[];
}

export interface CTInterpreterHandler {
    sendToInterpreter(trace : string, test : number, folder?: WorkspaceFolder | undefined): void;
}

