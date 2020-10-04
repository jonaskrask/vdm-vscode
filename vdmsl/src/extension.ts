/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as dialect from "./dialect"
import * as path from 'path';
import * as fs from 'fs'
import * as net from 'net';
import * as vscode from 'vscode';
import * as child_process from 'child_process';
import * as pf from 'portfinder';

import { 
	workspace, 
	ExtensionContext, 
	TextDocument,
	Uri
} from 'vscode';

import {
	LanguageClient,
	LanguageClientOptions,
	Location,
	Range,
	RequestMessage,
	RequestType,
	StreamInfo
} from 'vscode-languageclient';

var SERVERNAME = "lsp-0.0.1-SNAPSHOT.jar"
var VDMJNAME = "vdmj-4.3.0.jar"
var serverModule = 'lsp.LSPServerSocket'

let client: LanguageClient;

export interface MyDocument extends TextDocument {
	metadata: {}
}

export function activate(context: ExtensionContext) {
	let options = { cwd: workspace.rootPath};
	let clientLogFile = path.resolve(context.extensionPath, dialect.vdmDialect+'_lang_client.log');
	let serverLogFile = path.resolve(context.extensionPath, dialect.vdmDialect+'_lang_server.log');
	let vdmjPath = path.resolve(context.extensionPath,'resources', VDMJNAME);
	let lspServerPath = path.resolve(context.extensionPath,'resources', SERVERNAME);
	let javaExecutablePath = findJavaExecutable('java');

	// Thenable function to create the server with port connections. The function returns a promise of a StreamInfo object that represents the socket communication.
	function CreateServer(): Promise<StreamInfo> {
		return new Promise(async (resolve, reject) => {
			//Get port for lsp connection
			pf.getPortPromise()
				.then((lspPort) => {
					// Get port for dap connection
					pf.getPortPromise({port: lspPort+1})
						.then(async (dapPort) => {
							// jar args
							let args = [
								'-Dlog.filename='+ serverLogFile, '-cp', 
								vdmjPath+path.delimiter+lspServerPath,
								serverModule, '-'+dialect.vdmDialect, '-lsp', lspPort.toString(), '-dap', dapPort.toString()
							]
							// Start the LSP server
							child_process.spawn(javaExecutablePath, args, options);
							
							// Wait for the server to be ready
							let connected = false;
							let timeOutCounter = 0;
							while(!connected)
							{
								var t = net.connect(lspPort, 'localhost',() => { 
									t.destroy();
									connected = true;
								});
								await new Promise(resolve => setTimeout(resolve, 25))
								if(timeOutCounter++ == 100){
									writeToLog(clientLogFile, "ERROR: LSP server connection timeout");
									return reject("ERROR: LSP server connection timeout");
								}
							}
							
							// Connect to the LSP server
							var conn = net.createConnection(lspPort);
														
							conn.on('error', (err) => {								
								writeToLog(clientLogFile, "Error in creating connection" + err);
							});

							resolve({
								reader: conn,
								writer: conn
							});

							// **************** Initialize Debug Configurations **************
							// register a configuration provider for 'vdm' debug type
							const provider = new VdmConfigurationProvider();
							context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('vdm', provider));

							// run the debug adapter as a server inside the extension and communicating via a socket
							let factory = new VdmDebugAdapterDescriptorFactory(dapPort);

							context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory('vdm', factory));
							if ('dispose' in factory) {
								context.subscriptions.push(factory);
							}

						}).catch((dapPortErr) => { // Handle error for finding dap port
							writeToLog(clientLogFile,"Error in finding free dap port: " + dapPortErr);
							return reject(dapPortErr)
						}); 
				
				}).catch((lspPortErr) => { // Handle error for finding lsp port
					writeToLog(clientLogFile, "Error in finding free lsp port: " + lspPortErr);
					return reject(lspPortErr)
				});
			
		});
	};

	// Setup client options
	let ClientOptions: LanguageClientOptions = {
		// Document selector defines which files from the workspace, that is also open in the client, to monitor.
		documentSelector: [{ language: dialect.vdmDialect}],
		synchronize: {
			// Setup filesystem watcher for changes in vdm files
			fileEvents: workspace.createFileSystemWatcher('**/.'+dialect.vdmDialect)
		},
		middleware: {
			
			didOpen: (document: MyDocument, next: (document: MyDocument) => void): void => {
				document = {
					...document,
					metadata: { extraFlags: "-Wall" }
				};
				next(document);
			}
		}
	}
	
	// Create the language client with the defined client options and the function to create and setup the server.
	client = new LanguageClient(
		dialect.vdmDialect+'-lsp', 
		dialect.vdmDialect.toUpperCase()+' Language Server', 
		CreateServer, 
		ClientOptions);
		
	// Start the and launch the client
	let disposable = client.start();

	// Create client promise
	let clientPromise = new Promise<LanguageClient>((resolve, reject) => {
		client.onReady().then(() => {
			resolve(client);
		}, (error) => {
			reject(error);
		});
	});

	// Push the disposable to the context's subscriptions so that the client can be deactivated on extension deactivation
	context.subscriptions.push(disposable);


	////////////////////////////////////////////// Register commands //////////////////////////////////////////////////
	let pogHandler = new POGHandler(clientPromise);

	disposable = vscode.commands.registerCommand('extension.runPOG', (inputUri:Uri) => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Running Proof Obligation Generation');
		
		if (inputUri){
			vscode.window.showInformationMessage('Using file(s) from URI: ' + inputUri);
		}	
		else {
			inputUri = vscode.window.activeTextEditor?.document.uri
			vscode.window.showInformationMessage('Using active file ' + inputUri);
		}

		pogHandler.generate(inputUri)
	});
	context.subscriptions.push(disposable);

	disposable = vscode.commands.registerCommand('extension.retrievePOs', () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		vscode.window.showInformationMessage('Running Proof Obligation Generation');

		pogHandler.retrieve([1,2])
	});
	context.subscriptions.push(disposable);
	
}



function writeToLog(path:string, msg:string){
	let logStream = fs.createWriteStream(path, { flags: 'w' });
	logStream.write(msg);
	logStream.close();
}

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}

class VdmConfigurationProvider implements vscode.DebugConfigurationProvider {
	/**
	 * Massage a debug configuration just before a debug session is being launched,
	 * e.g. add all missing attributes to the debug configuration.
	 */
	resolveDebugConfiguration(folder: vscode.WorkspaceFolder | undefined, config: vscode.DebugConfiguration, token?: vscode.CancellationToken): vscode.ProviderResult<vscode.DebugConfiguration> {

		// if launch.json is missing or empty
		if (!config.type && !config.request && !config.name) {
			const editor = vscode.window.activeTextEditor;
			if (editor && editor.document.languageId === dialect.vdmDialect) {
				config.type = 'vdm';
				config.name = 'Launch';
				config.request = 'launch';
				config.stopOnEntry = true;
				config.noDebug = false;
			}
		}

		return config;
	}
}

class VdmDebugAdapterDescriptorFactory implements vscode.DebugAdapterDescriptorFactory {
	constructor(
		private dapPort: number
		){}

	createDebugAdapterDescriptor(session: vscode.DebugSession, executable: vscode.DebugAdapterExecutable | undefined): vscode.ProviderResult<vscode.DebugAdapterDescriptor> {
		// make VS Code connect to debug server
		return new vscode.DebugAdapterServer(this.dapPort);
	}
}

// MIT Licensed code from: https://github.com/georgewfraser/vscode-javac
function findJavaExecutable(binname: string) {
	if (process.platform === 'win32')
		binname = binname + '.exe';

	// First search each JAVA_HOME bin folder
	if (process.env['JAVA_HOME']) {
		let workspaces = process.env['JAVA_HOME'].split(path.delimiter);
		for (let i = 0; i < workspaces.length; i++) {
			let binpath = path.join(workspaces[i], 'bin', binname);
			if (fs.existsSync(binpath)) {
				return binpath;
			}
		}
	}

	// Then search PATH parts
	if (process.env['PATH']) {
		let pathparts = process.env['PATH'].split(path.delimiter);
		for (let i = 0; i < pathparts.length; i++) {
			let binpath = path.join(pathparts[i], binname);
			if (fs.existsSync(binpath)) {
				return binpath;
			}
		}
	}

	// Else return the binary name directly (this will likely always fail downstream) 
	return null;
}


////////////////////////////////////////////// LSPx Stuff /////////////////////////////////////////////
interface LspxParams {
	submethod: string
}

interface VDMSourceCode {
	source: string;
}

interface ProofObligationHeader {
	id: number;
	name: string;
	type: string;
}

interface ProofObligation {
	id: number;
	type: string;
	location: Location;
	source: VDMSourceCode;
}

interface GeneratePOParams extends LspxParams {
	uri: string;
	range?: Range;
}

namespace GeneratePORequest {
	export const type = new RequestType<GeneratePOParams, ProofObligationHeader[] | null, void, void>('lspx');
}

interface RetrievePOParams extends LspxParams {
	ids: number[];
}

namespace RetrievePORequest {
	export const type = new RequestType<RetrievePOParams, ProofObligation[] | null, void, void>('lspx');
}






class POGHandler {

	private readonly client: Promise<LanguageClient>

	public constructor(client: Promise<LanguageClient>) {
		this.client = client;
	}
	
	async generate(uri: Uri, range?: Range): Promise<ProofObligationHeader[]> {
		let client = await this.client;
		let params: GeneratePOParams = {
			submethod: 'POG/generate',  
			uri: uri.toString(),
			range: range
		};
		const values = await client.sendRequest(GeneratePORequest.type, params);
		return values;
	}

	async retrieve(ids:number[]): Promise<ProofObligation[]> {
		let client = await this.client;
		let params: RetrievePOParams = {
			submethod: 'POG/retrieve',  
			ids: ids
		};
		const values = await client.sendRequest(RetrievePORequest.type, params);
		return values;
	}
}