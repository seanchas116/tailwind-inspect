import * as babel from "@babel/types";
import { JSXTextNode } from "./JSXTextNode";
import { JSXOtherNode } from "./JSXOtherNode";
import { Style } from "../style/Style";
import { JSXElementUtil } from "../../util/JSXElementUtil";
import { NodeBase } from "./NodeBase";
import { filterInstance } from "@seanchas116/paintkit/src/util/Collection";

export class JSXElementNode extends NodeBase<
  JSXElementNode,
  JSXElementNode,
  JSXElementNode | JSXTextNode | JSXOtherNode
> {
  constructor(ast: babel.JSXElement) {
    super();
    this.ast = ast;
    this.loadAST(ast);
  }

  ast: babel.JSXElement;
  readonly style = new Style();
  readonly computedStyle = new Style();

  loadAST(ast: babel.JSXElement) {
    const oldChildren = this.children;
    const oldTextNodes = filterInstance(oldChildren, [JSXTextNode]);
    const oldOtherNodes = filterInstance(oldChildren, [JSXOtherNode]);
    const oldElementNodes = filterInstance(oldChildren, [JSXElementNode]);

    const children = ast.children.map((child) => {
      if (child.type === "JSXText") {
        const node = oldTextNodes.shift();
        if (node) {
          node.loadAST(child);
          return node;
        } else {
          return new JSXTextNode(child);
        }
      } else if (child.type === "JSXElement") {
        const node = oldElementNodes.shift();
        if (node) {
          node.loadAST(child);
          return node;
        } else {
          return new JSXElementNode(child);
        }
      } else {
        const node = oldOtherNodes.shift();
        if (node) {
          node.loadAST(child);
          return node;
        } else {
          return new JSXOtherNode(child);
        }
      }
    });

    this.ast = ast;
    this.clear();
    this.append(...children);
    this.style.loadTailwind(
      JSXElementUtil.getAttribute(ast.openingElement, "className") ?? ""
    );
  }

  updateAST(): void {
    const children = this.children;
    children.forEach((c) => c.updateAST());

    this.ast.children = children.map((c) => c.ast);
    // this.style.toTailwind();
    JSXElementUtil.setAttribute(
      this.ast.openingElement,
      "className",
      this.style.toTailwind()
    );
  }

  get tagName(): string {
    if (this.ast.openingElement.name.type === "JSXIdentifier") {
      return this.ast.openingElement.name.name;
    } else {
      return "div";
    }
  }
}
