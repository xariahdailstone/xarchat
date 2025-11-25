
// type NodePredicate = (n: Node) => boolean;

// function isInclusiveAncestorOf(potentialAncestor: Node, checkNode: Node) {
//     let curCheckNode: (Node | null) = checkNode;
//     while (curCheckNode != null) {
//         if (curCheckNode == potentialAncestor) { return true; }
//         curCheckNode = curCheckNode.parentNode;
//     }
//     return false;
// }

// function *iterateChildrenInTreeOrder(node: Node): Iterable<Node> {
//     const childNodes = node.childNodes;
//     const childNodesLength = childNodes.length;
//     for (let i = 0; i < childNodesLength; i++) {
//         const childNode = childNodes.item(i);
//         yield childNode;
//         for (let tchild of iterateChildrenInTreeOrder(childNode)) {
//             yield tchild;
//         }
//     }
// }

// function findFirstChild(parentNode: Node, predicate: NodePredicate) {
//     for (let i = 0; i < parentNode.childNodes.length; i++) {
//         const thisChild = parentNode.childNodes.item(i);
//         if (predicate(thisChild)) {
//             return thisChild;
//         }
//     }
//     return null;
// }

// function findLastChild(parentNode: Node, predicate: NodePredicate) {
//     for (let i = parentNode.childNodes.length - 1; i >= 0; i--) {
//         const thisChild = parentNode.childNodes.item(i);
//         if (predicate(thisChild)) {
//             return thisChild;
//         }
//     }
//     return null;
// }

// function findMatchingChildren(parentNode: Node, predicate: NodePredicate) {
//     const result: Node[] = [];
//     for (let i = 0; i < parentNode.childNodes.length; i++) {
//         const thisChild = parentNode.childNodes.item(i);
//         if (predicate(thisChild)) {
//             result.push(thisChild);
//         }
//     }
//     return result;
// }

// function isPartiallyContainedInRange(checkNode: Node, range: AbstractRange) {
//     const isAncestorOfStart = isInclusiveAncestorOf(checkNode, range.startContainer);
//     const isAncestorOfEnd = isInclusiveAncestorOf(checkNode, range.endContainer);
//     return (isAncestorOfStart && !isAncestorOfEnd) || (!isAncestorOfStart && isAncestorOfEnd);
// }

// function isChildOf(potentialChild: Node, potentialParent: Node) {
//     const childNodes = potentialChild.childNodes;
//     const childNodesLength = childNodes.length;
//     for (let i = 0; i < childNodesLength; i++) {
//         if (childNodes.item(i) == potentialChild) { return true; }
//     }
//     return false;
// }

// function getPathFromRoot(n: Node): Node[] {
//     const result: Node[] = [];
//     let curNode: (Node | null) = n;
//     while (curNode != null) {
//         result.unshift(curNode);
//         curNode = curNode.parentNode;
//     }
//     return result;
// }

// function getCommonAncestor(a: Node, b: Node): Node {
//     const aPathFromRoot = getPathFromRoot(a);
//     const bPathFromRoot = getPathFromRoot(b);
//     let i = 0;
//     while (aPathFromRoot[i] == bPathFromRoot[i]) {
//         i++;
//     }
//     return aPathFromRoot[i - 1];
// }

// function isFollowing(a: Node, b: Node) {
//     if (a.getRootNode() != b.getRootNode()) { return false; }
//     const commonAncestor = getCommonAncestor(a, b);
//     for (let tchild of iterateChildrenInTreeOrder(commonAncestor)) {
//         if (tchild == a) { return false; }
//         if (tchild == b) { return true; }
//     }
//     return false;
// }

// function getChildIndex(node: Node) {
//     const parentNode = node.parentNode!;
//     const childNodes = parentNode.childNodes;
//     const childNodesLength = childNodes.length;
//     for (let i = 0; i < childNodesLength; i++) {
//         const thisChild = childNodes.item(i);
//         if (thisChild == node) { return i; }
//     }
//     return -1;
// }

// function getRelativePosition(nodeA: Node, offsetA: number, nodeB: Node, offsetB: number): ("before" | "equal" | "after") {
//     if (nodeA == nodeB) {
//         if (offsetA == offsetB) { return "equal"; }
//         if (offsetA < offsetB) { return "before"; }
//         if (offsetA > offsetB) { return "after"; }
//     }
//     if (isFollowing(nodeA, nodeB)) {
//         const crel = getRelativePosition(nodeB, offsetB, nodeA, offsetA);
//         if (crel == "before") { return "after"; }
//         if (crel == "after") { return "before"; }
//     }
//     if (isInclusiveAncestorOf(nodeA, nodeB)) {
//         let child = nodeB;
//         while (!isChildOf(child, nodeA)) {
//             child = child.parentNode!;
//         }
//         if (getChildIndex(child) < offsetA) { return "after"; }
//     }
//     return "before";
// }

// function getNodeLength(node: Node) {
//     const nodeType = node.nodeType;
//     if (nodeType == Node.DOCUMENT_TYPE_NODE || nodeType == Node.ATTRIBUTE_NODE) { return 0; }
//     if (isCharacterDataNode(node)) { return node.textContent!.length; }
//     return node.childNodes.length;
// }

// function isContainedInRange(checkNode: Node, range: AbstractRange) {
//     const rootsEqual = checkNode.getRootNode() == range.startContainer.getRootNode();
//     return rootsEqual &&
//         getRelativePosition(checkNode, 0, range.startContainer, range.startOffset) == "after" &&
//         getRelativePosition(checkNode, getNodeLength(checkNode), range.endContainer, range.endOffset) == "before";
// }

// function isCharacterDataNode(node: Node | null) {
//     if (node == null) { return false; }
//     const nodeType = node.nodeType;
//     return nodeType == Node.TEXT_NODE ||
//         nodeType == Node.PROCESSING_INSTRUCTION_NODE ||
//         nodeType == Node.COMMENT_NODE;
// }

// export class RangeUtils {
//     static cloneContents(range: AbstractRange): DocumentFragment {
//         // step 1
//         const fragment = range.startContainer.ownerDocument!.createDocumentFragment();
//         // step 2
//         if (range.collapsed) { return fragment; }
//         // step 3
//         let originalStartNode = range.startContainer;
//         let originalStartOffset = range.startOffset;
//         let originalEndNode = range.endContainer;
//         let originalEndOffset = range.endOffset;
//         // step 4
//         if (originalStartNode == originalEndNode && isCharacterDataNode(originalStartNode)) {
//             // step 4.1
//             let clone = originalStartNode.cloneNode();
//             // step 4.2
//             clone.textContent = originalStartNode.textContent!.substr(originalStartOffset, originalEndOffset - originalStartOffset);
//             // step 4.3
//             fragment.appendChild(clone);
//             // step 4.4
//             return fragment;
//         }
//         // step 5
//         let commonAncestor = originalStartNode;
//         // step 6
//         while (!isInclusiveAncestorOf(commonAncestor, originalEndNode)) {
//             commonAncestor = commonAncestor.parentNode!;
//         }
//         // step 7
//         let firstPartiallyContainedChild: (Node | null) = null;
//         // step 8
//         if (!isInclusiveAncestorOf(originalStartNode, originalEndNode)) {
//             firstPartiallyContainedChild = findFirstChild(commonAncestor, n => isPartiallyContainedInRange(n, range));
//         }
//         // step 9
//         let lastPartiallyContainedChild: (Node | null) = null;
//         // step 10
//         if (!isInclusiveAncestorOf(originalEndNode, originalStartNode)) {
//             lastPartiallyContainedChild = findLastChild(commonAncestor, n => isPartiallyContainedInRange(n, range));
//         }
//         // step 11
//         let containedChildren = findMatchingChildren(commonAncestor, n => isContainedInRange(n, range));
//         // step 12
//         if (containedChildren.filter(n => n.nodeType == Node.DOCUMENT_TYPE_NODE).length > 0) {
//             throw new DOMException("HierarchyRequestError");
//         }
//         // step 13
//         if (isCharacterDataNode(firstPartiallyContainedChild)) {
//             // step 13.1
//             let clone = originalStartNode.cloneNode();
//             // step 13.2
//             clone.textContent = originalStartNode!.textContent!.substr(originalStartOffset, originalStartNode.textContent!.length - originalStartOffset);
//             // step 13.3
//             fragment.appendChild(clone);
//         }
//         // step 14
//         else if (firstPartiallyContainedChild != null) {
//             // step 14.1
//             let clone = firstPartiallyContainedChild.cloneNode();
//             // step 14.2
//             fragment.appendChild(clone);
//             // step 14.3
//             let subrange = new StaticRange({ 
//                 startContainer: originalStartNode, startOffset: originalStartOffset,
//                 endContainer: firstPartiallyContainedChild, endOffset: firstPartiallyContainedChild.textContent!.length
//             });
//             // step 14.4
//             let subfragment = RangeUtils.cloneContents(subrange);
//             // step 14.5
//             clone.appendChild(subfragment);
//         }
//         // step 15
//         for (let containedChild of containedChildren) {
//             // step 15.1
//             let clone = containedChild.cloneNode(true);
//             // step 15.2
//             fragment.appendChild(clone);
//         }
//         // step 16
//         if (isCharacterDataNode(lastPartiallyContainedChild)) {
//             // step 16.1
//             let clone = originalEndNode.cloneNode();
//             // step 16.2
//             clone.textContent = originalEndNode.textContent!.substr(0, originalEndOffset);
//             // step 16.3
//             fragment.appendChild(clone);
//         }
//         // step 17
//         else if (lastPartiallyContainedChild != null) {
//             // step 17.1
//             let clone = lastPartiallyContainedChild.cloneNode();
//             // step 17.2
//             fragment.appendChild(clone);
//             // step 17.3
//             let subrange = new StaticRange({
//                 startContainer: lastPartiallyContainedChild, startOffset: 0,
//                 endContainer: originalEndNode, endOffset: originalEndOffset
//             });
//             // step 17.4
//             let subfragment = RangeUtils.cloneContents(subrange);
//             // step 17.5
//             fragment.appendChild(subfragment);
//         }
//         // step 18
//         return fragment;
//     }
// }