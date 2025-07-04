import { PromiseSource } from "./PromiseSource";

let delayingBlockCount = 0;

export function enterDelayingBlock<T>(func: () => T): T {
    delayingBlockCount++;
    try {
        return func();
    }
    finally {
        delayingBlockCount--;
        if (delayingBlockCount == 0) {
            runDelayedExecutions();
        }
    }
}

export async function enterDelayingBlockAsync<T>(func: () => Promise<T>): Promise<T> {
    delayingBlockCount++;
    try {
        const res = await func();
        return res;
    }
    finally {
        delayingBlockCount--;
        if (delayingBlockCount == 0) {
            runDelayedExecutions();
        }
    }
}

let delayedExecutions: {ps: PromiseSource<any>, func: (() => any)}[] = [];
function runDelayedExecutions() {
    while (delayedExecutions.length > 0) {
        const dx = delayedExecutions;
        delayedExecutions = [];
        
        delayingBlockCount++;
        try {
            while (dx.length > 0) {
                const dxe = dx.shift()!;
                try {
                    const res = dxe.func();
                    dxe.ps.resolve(res);
                }
                catch (e) { 
                    dxe.ps.reject(e);
                }
            }
        }
        finally {
            delayingBlockCount--;
        }
    }
}

export function delayExecuteAsync<T>(func: () => any): Promise<T> {
    const ps = new PromiseSource<T>();

    if (delayingBlockCount == 0) {
        enterDelayingBlock(() => {
            try {
                const res = func();
                ps.resolve(res);
            }
            catch (e) {
                ps.reject(e);
            }
        });
    }
    else {
        delayedExecutions.push({ ps: ps, func: func });
    }

    return ps.promise;
}