import { Optional } from "./Optional";

export class LinkedList<T> {
    constructor() {
    }

    private _head: LinkedListNode<T> | null = null;
    private _tail: LinkedListNode<T> | null = null;

    private _length: number = 0;
    get length() { return this._length; }

    addFirst(item: T): LinkedListNode<T> {
        const node = new LinkedListNode<T>(this, item);

        const nextNode = this._head;

        if (nextNode) {
            node.next = nextNode;
            nextNode.prev = node;
        }
        else {
            this._tail = node;
        }

        this._head = node;

        this._length++;

        return node;
    }

    addLast(item: T): LinkedListNode<T> {
        const node = new LinkedListNode<T>(this, item);

        const prevNode = this._tail;

        if (prevNode) {
            node.prev = prevNode;
            prevNode.next = node;
        }
        else {
            this._head = node;
        }

        this._tail = node;

        this._length++;

        return node;
    }

    push(item: T) {
        this.addLast(item);
    }

    pop(): Optional<T> {
        if (this._tail) {
            const result = this._tail.value;
            this.removeNode(this._tail);
            return result;
        }
        else {
            return null;
        }
    }

    unshift(item: T) {
        this.addFirst(item);
    }

    shift(): Optional<T> {
        if (this._head) {
            const result = this._head.value;
            this.removeNode(this._head);
            return result;
        }
        else {
            return null;
        }
    }

    removeWhere(filter: (item: T, node: LinkedListNode<T>) => boolean) {
        let n = this._head;
        while (n != null) {
            const nextNode = n.next;
            if (filter(n.value, n)) {
                this.removeNode(n);
            }
            n = nextNode;
        }
    }

    removeNode(node: LinkedListNode<T>) {
        if (node.owner != this) { return; }

        const prevNode = node.prev;
        const nextNode = node.next;

        if (prevNode) {
            prevNode.next = node.next;
        }
        if (nextNode) {
            nextNode.prev = node.prev;
        }

        if (this._head == node) {
            this._head = nextNode;
        }
        if (this._tail == node) {
            this._tail = prevNode;
        }

        this._length--;

        node.owner = null;
        node.prev = null;
        node.next = null;
    }

    [Symbol.iterator](): Iterable<T> { return this.values(); }

    *values() {
        let n = this._head;
        while (n != null) {
            yield n.value;
            n = n.next;
        }
    }

    *nodes() {
        let n = this._head;
        while (n != null) {
            yield n;
            n = n.next;
        }
    }
}

class LinkedListNode<T> {
    constructor(
        public owner: LinkedList<T> | null,
        public readonly value: T) {
    }

    prev: LinkedListNode<T> | null = null;
    next: LinkedListNode<T> | null = null;

    remove() {
        if (this.owner) {
            this.owner.removeNode(this);
        }
    }
}