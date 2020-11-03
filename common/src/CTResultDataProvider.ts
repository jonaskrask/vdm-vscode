import { Event, EventEmitter, ProviderResult, TreeDataProvider, TreeItem, TreeItemCollapsibleState } from "vscode";
import { CTResultPair } from "./protocol.lspx";

export class CTResultDataProvider implements TreeDataProvider<CTResultElement> {

    private _testSequenceResults: CTResultElement[] = [];

    private _onDidChangeTreeData: EventEmitter<CTResultElement | undefined> = new EventEmitter<CTResultElement | undefined>();
    onDidChangeTreeData: Event<CTResultElement> = this._onDidChangeTreeData.event;

    getTreeItem(element: CTResultElement): TreeItem | Thenable<TreeItem> {
        return element;
    }

    getChildren(element?: CTResultElement): ProviderResult<CTResultElement[]> {
        if(element)
            return [];
        
        return this._testSequenceResults;
    }

    private convertToResultElements(resultPairs: CTResultPair[]): CTResultElement[]{
        return resultPairs.map(rs => new CTResultElement(rs.case, rs.result));
    }

    public getTestSequenceResults(){
        return this._testSequenceResults;
    }

    public setTestSequenceResults(resultPairs: CTResultPair[]){
        if(!resultPairs)
            return;

        this._testSequenceResults = this.convertToResultElements(resultPairs);
        this._onDidChangeTreeData.fire(null);
    }
}

export class CTResultElement extends TreeItem {

    constructor(
    public readonly label: string,
    description: string | boolean
    ) {
        super(label, TreeItemCollapsibleState.None);
       super.description = description;
    }
}