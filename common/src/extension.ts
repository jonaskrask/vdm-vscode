/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import {VdmDapSupport as dapSupport} from "./VdmDapSupport"
import * as util from "./Util"
import * as path from 'path';
import * as net from 'net';
import * as child_process from 'child_process';
import * as portfinder from 'portfinder';
import * as vscode from 'vscode'
import { 
	workspace, 
	ExtensionContext} from 'vscode';
import {
    LanguageClientOptions,
    ServerOptions,
    StreamInfo
} from 'vscode-languageclient';
import { SpecificationLanguageClient } from "./SpecificationLanguageClient";

let client : SpecificationLanguageClient;

export async function activate(context: ExtensionContext, vdmDialect : string) {
    let clientLogFile = path.resolve(context.extensionPath, vdmDialect + '_lang_client.log');
    let serverLogFile = path.resolve(context.extensionPath, vdmDialect + '_lang_server.log');
    let serverMainClass = 'lsp.LSPServerStdio'
	let vdmjPath = util.recursivePathSearch(path.resolve(context.extensionPath, "resources"), /vdmj.*jar/i);
    let lspServerPath = util.recursivePathSearch(path.resolve(context.extensionPath, "resources"), /lsp.*jar/i);
    if(!vdmjPath || !lspServerPath)
        return;

    extensionLanguage = vdmDialect;

    function createServer(): Promise<StreamInfo> {
        return new Promise(async (resolve, reject) => {
            portfinder.getPortPromise()
                .then((dapPort) => {

                    let args : string[] = [];
                    let JVMArguments = workspace.getConfiguration(vdmDialect + '-lsp').JVMArguments;
                    if(JVMArguments != "")
                        args.push(JVMArguments);

                    let activateServerLog = workspace.getConfiguration(vdmDialect + '-lsp').activateServerLog;
                    if(activateServerLog)
                        args.push('-Dlog.filename=' + serverLogFile);

                    args.push(...[
                        '-cp', vdmjPath + path.delimiter + lspServerPath,
                        serverMainClass,
                        '-' + vdmDialect,
                        '-dap', dapPort.toString()
                    ]);

                    // Start the LSP server
                    let javaPath = util.findJavaExecutable('java');
                    if (!javaPath) {
                        vscode.window.showErrorMessage("Java runtime environment not found!")
                        util.writeToLog(clientLogFile, "Java runtime environment not found!");
                        return reject("Java runtime environment not found!");
                    }
                    let server = child_process.spawn(javaPath, args);

                    resolve({
                        reader: server.stdout,
                        writer: server.stdin
                    });

                    dapSupport.initDebugConfig(context, dapPort, vdmDialect)
                })
                .catch((err) => {
                    util.writeToLog(clientLogFile, "An error occured when finding a free dap port: " + err);
                    return reject(err)
                });
        })
    }

    let serverOptions: ServerOptions
    let debug = workspace.getConfiguration(vdmDialect + '-lsp').experimentalServer;
    if (debug) {
        let defaultLspPort = workspace.getConfiguration(vdmDialect + '-lsp').lspPort;
        let defaultDapPort = workspace.getConfiguration(vdmDialect + '-lsp').dapPort;

        serverOptions = () => {
            // Connect to language server via socket
            let socket = net.connect({ port: defaultLspPort });
            let result: StreamInfo = {
                writer: socket,
                reader: socket
            };
            return Promise.resolve(result);
        };

        dapSupport.initDebugConfig(context, defaultDapPort, vdmDialect)
    }
    else {
        serverOptions = createServer
    }

    // Setup client options
    let clientOptions: LanguageClientOptions = {
        // Document selector defines which files from the workspace, that is also open in the client, to monitor.
        documentSelector: [{ language: vdmDialect }],
        synchronize: {
            // Setup filesystem watcher for changes in vdm files
            fileEvents: workspace.createFileSystemWatcher('**/.' + vdmDialect)
        }
    }

    // Create the language client with the defined client options and the function to create and setup the server.
    let client = new SpecificationLanguageClient(
        vdmDialect + '-lsp',
        vdmDialect.toUpperCase() + ' Language Server',
        serverOptions,
        clientOptions,
        context
    );

    // Start the and launch the client
    let disposable = client.start();

    // Push the disposable to the context's subscriptions so that the client can be deactivated on extension deactivation
    context.subscriptions.push(disposable);
}

export function deactivate(): Thenable<void> | undefined {
	if (!client) {
		return undefined;
	}
	return client.stop();
}

export var extensionLanguage: string;