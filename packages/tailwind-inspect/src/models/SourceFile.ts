import * as babel from "@babel/types";
import { action, computed, makeObservable, observable, reaction } from "mobx";
import { parse } from "@babel/parser";
import { transform } from "@babel/standalone";
import * as recast from "recast";
import { DebugSource } from "./DebugSource";
import { SourceFileNode } from "./node/SourceFileNode";
import { JSXElementNode } from "./node/JSXElementNode";
import { filterInstance } from "@seanchas116/paintkit/src/util/Collection";
import { JSXNode } from "./node/JSXNode";
import { JSXTextNode } from "./node/JSXTextNode";
import { JSXFragmentNode } from "./node/JSXFragmentNode";
import { JSXExpressionContainerNode } from "./node/JSXExpressionContainerNode";
import { JSXSpreadChildNode } from "./node/JSXSpreadChildNode";

function parseCode(code: string): babel.File {
  return recast.parse(code, {
    parser: {
      parse(code: string) {
        return parse(code, {
          sourceType: "module",
          plugins: ["jsx", "typescript"],
          tokens: true,
        });
      },
    },
  });
}

export class SourceFile {
  constructor(code: string) {
    const ast = parseCode(code);
    this.node = new SourceFileNode(ast);
    this._code = code;
    this.compileCode();

    makeObservable(this);

    reaction(
      () => this.selectedElements,
      (elements) => {
        console.log(elements);
      }
    );
  }

  private _fsHandle: FileSystemFileHandle | undefined = undefined;

  async openFile(fsHandle: FileSystemFileHandle) {
    const file = await fsHandle.getFile();
    const code = await file.text();

    const ast = parseCode(code);
    this.node = new SourceFileNode(ast);
    this._code = code;
    this.compileCode();
    this._fsHandle = fsHandle;
  }

  get fsHandle() {
    return this._fsHandle;
  }

  @observable node: SourceFileNode;

  @observable private _code: string;
  @observable private _compiledCode = "";

  get code(): string {
    return this._code;
  }

  get compiledCode(): string {
    return this._compiledCode;
  }

  async updateCode() {
    this.node.updateAST();

    const { code } = recast.print(this.node.ast);
    this._code = code;

    const newAST = parseCode(code);
    this.node.loadAST(newAST);

    this.compileCode();

    if (this.fsHandle) {
      const writable = await this.fsHandle.createWritable();
      await writable.write(code);
      await writable.close();
    }
  }

  private compileCode() {
    const output = transform(this._code, {
      presets: ["env", "react"],
      plugins: ["transform-react-jsx-source"],
    }).code;
    //console.log(output);
    this._compiledCode = output ?? "";
  }

  @observable hoveredElement: JSXElementNode | undefined = undefined;

  @computed get selectedElements(): readonly JSXElementNode[] {
    return filterInstance(this.node.selectedDescendants, [JSXElementNode]);
  }
  @computed get selectedNodes(): readonly JSXNode[] {
    return filterInstance(this.node.selectedDescendants, [
      JSXElementNode,
      JSXTextNode,
      JSXFragmentNode,
      JSXExpressionContainerNode,
      JSXSpreadChildNode,
    ]);
  }

  selectFromDebugSource(debugSource: DebugSource): void {
    this.node.deselect();

    this.node.forEachDescendant((node) => {
      if (node instanceof JSXElementNode) {
        if (
          node.ast.loc?.start.line === debugSource.lineNumber &&
          node.ast.loc?.start.column === debugSource.columnNumber - 1
        ) {
          node.select();
        }
      }
    });
  }
}
