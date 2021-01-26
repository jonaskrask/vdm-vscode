# VDM Language Support in Visual Studio Code

[![Version](https://img.shields.io/visual-studio-marketplace/v/jonaskrask.vdm-vscode)](https://marketplace.visualstudio.com/items?itemName=jonaskrask.vdm-vscode)
[![Downloads](https://img.shields.io/visual-studio-marketplace/d/jonaskrask.vdm-vscode)](https://marketplace.visualstudio.com/items?itemName=jonaskrask.vdm-vscode)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/jonaskrask.vdm-vscode)](https://marketplace.visualstudio.com/items?itemName=jonaskrask.vdm-vscode)

VDM-VSCode is an extension for Visual Studio Code (VS Code) that provides language support for the VDM dialects VDM-SL, VDM++ and VDM-RT.
The extension utilises a [language server powered by VDMJ](https://github.com/nickbattle/vdmj/tree/master/lsp) that is developed by [Nick Battle](https://github.com/nickbattle). 

<img src="https://github.com/jonaskrask/vdm-vscode/raw/master/screenshots/GUI.png" width="800">

## Requirements
- [VS Code ≥ v. 1.49.0](https://code.visualstudio.com/download)
- [Java ≥ v. 11](https://adoptopenjdk.net/)

## Features
- Syntax Highlighting
- Syntax- and type-checking
- Smart navigation
- Debugging
- Proof Obligation Generation
- Combinatiorial Testing
- Translation to LaTeX and Word

### Future Work
- Import of project examples
- Improve syntax highlighting
- Improve debugging execution
- Include coverage report
- Show all workspace folders in the Combinatorial Testing view

## Usage
Open a folder (single VDM project) or a workspace (multiple VDM projects) and then open a VDM file(.vdmsl, .vdmpp or .vdmrt) in from the explorer window. This will automatically start language server in the background.
The following displays snippets of the feature functionalities provided by the extension and their use:

- **Syntax highlighting**: VDM keywords are automatically highlighted.
<br><br> <img src="https://github.com/jonaskrask/vdm-vscode/raw/master/screenshots/syntax_highlighting.png" width="700">

- **Syntax- and type-checking**: Syntax- and type-errors and warnings are highligthed in the editor and detailed in the terminal or by hovering on the highlighted section.
<br><br> <img src="https://github.com/jonaskrask/vdm-vscode/raw/master/screenshots/syntax_checking.gif" width="700">

- **Smart navigation**: Mutiple actions exists for navigating to the definition of a given identifier in a specification: Ctrl + click, the right-click context menu or pressing F12 while hovering on the identifier.
<br><br> <img src="https://github.com/jonaskrask/vdm-vscode/raw/master/screenshots/smart_navigation.gif" width="700">

- **Debugging**: A debugging session can be initiated using the standard VS Code debug interface. This launches the VDMJ interpreter enabling commands to be issued through the terminal. For a list of the available commands type `help`.
<br><br> <img src="https://github.com/jonaskrask/vdm-vscode/raw/master/screenshots/debugging.gif" width="700">

- **Proof Obligation Generation**: Proof obligation generation can be performed for a specification by accessing the editor context menu (right-clicking in the editor window). Alternatively the explorer contex menu can be used by right-clicking a VDM file in the explorer window.
<br><br> <img src="https://github.com/jonaskrask/vdm-vscode/raw/master/screenshots/POG.gif" width="700">

- **Combinatiorial Testing**: Combinatorial testing can be performed for a given specification by accessing the "Combinatorial Testing" menu in the activity bar.
<br><br> <img src="https://github.com/jonaskrask/vdm-vscode/raw/master/screenshots/CT.gif" width="700">

- **Translation to LaTeX and Word**: A specification can be translated to LaTex or Word formats by accessing the editor context menu by right-clicking in the editor.
<br><br> <img src="https://github.com/jonaskrask/vdm-vscode/raw/master/screenshots/translation.gif" width="700">


## Installation
Just type @id:jonaskrask.vdm-vscode in the Extensions view Search box or type vdm and select VDM VSCode.

## Settings
This extension contributes the following settings:
- `vdm-vscode.JVMArguments`: Arguments for the JVM that is executing the server (e.g. -Xmx2g).
- `vdm-vscode.annotationPaths`: Comma separated list of folders and/or jar file paths for annotations that should be used with the language server.
- `vdm-vscode.highPrecision`: Use high precision server that use more memory for variables ("on" or "off").
- `vdm-vscode.debug.activateServerLog`: Log server actions ("on" or "off").
- `vdm-vscode.debug.experimentalServer`: Use an experimental/external server ("on" or "off"). If "on" the client will not launch a server but instead connect to one that is running in another process. E.g. executing the VDMJ server in a debugger.
- `vdm-vscode.debug.lspPort`: Port used for the LSP/SLSP connection when `experimentalServer` is "on".
- `vdm-vscode.debug.dapPort`: Port used for the DAP connection when `experimentalServer` is "on".


## Publications
Jonas K. Rask, Frederik P. Madsen, Nick Battle, Hugo D. Macedo and Peter G. Larsen, 
[Visual Studio Code VDM Support](https://www.researchgate.net/publication/346680627_Visual_Studio_Code_VDM_Support),
The 18th Overture Workshop, December 2020 [[PDF](https://www.researchgate.net/publication/346680627_Visual_Studio_Code_VDM_Support)]

## Change Log
See change log [here](CHANGELOG.md).

## Issues
Submit an [issue](https://github.com/jonaskrask/vdm-vscode/issues) if you find a bug or have a suggestion for improving the extension.

## Contributing
Contributions are very welcome. To do so either open an issue or feature request or fork the [repo](https://github.com/jonaskrask/vdm-vscode) and submit a pull request.
For further information see [here](CONTRIBUTING.md).
