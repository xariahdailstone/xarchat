import { FListApi, KinkList } from "../../fchat/api/FListApi";
import { CancellationToken } from "../CancellationTokenSource";
import { HostInterop } from "../HostInterop";
import { PromiseSource } from "../PromiseSource";
import { TaskUtils } from "../TaskUtils";

export interface KinksManager {
    getKinksSetAsync(cancellationToken: CancellationToken): Promise<KinksSet>;
}

export interface KinksSet {
    getKinkGroupById(id: number): KinkGroupInfo;
    getKinkById(id: number): KinkInfo;

    readonly allKinkGroupsById: ReadonlyMap<number, KinkGroupInfo>;
    readonly allKinksById: ReadonlyMap<number, KinkInfo>;
}

export interface KinkInfo {
    readonly isMissingKink: boolean;
    readonly id: number;
    readonly name: string;
    readonly description: string;
    readonly kinkGroup: KinkGroupInfo;
}

export interface KinkGroupInfo {
    readonly isMissingKinkGroup: boolean;
    readonly id: number;
    readonly name: string;
    readonly kinks: ReadonlySet<KinkInfo>;
}

const MISSING_KINK_GROUP: KinkGroupInfo = {
    isMissingKinkGroup: true,
    id: -1,
    name: "Missing Kink Group",
    kinks: new Set()
};
const MISSING_KINK: KinkInfo = {
    isMissingKink: true,
    id: -1,
    name: "Missing Kink",
    description: "This kink is missing.",
    kinkGroup: MISSING_KINK_GROUP
};

export class DefaultKinksManager implements KinksManager {
    constructor(flistApi: FListApi) {
        // TODO: populate kinksset

        (async () => {
            try {
                const kinkList = await flistApi.getKinksListAsync(CancellationToken.NONE);
                const kinkSet = this.createDefaultKinksSet(kinkList);
                this._kinksSetPromiseSource.resolve(kinkSet);
            }
            catch {
                this._kinksSetPromiseSource.resolve(new DefaultKinksSet(new Map(), new Map()));
            }
        })();
    }

    private createDefaultKinksSet(kinkList: KinkList): DefaultKinksSet {
        const groupsById: Map<number, KinkGroupInfo> = new Map();
        const kinksById: Map<number, KinkInfo> = new Map();

        for (let groupIdStr of Object.getOwnPropertyNames(kinkList)) {
            const groupId = +groupIdStr;
            const groupInfo = kinkList[groupIdStr];
            
            const g = {
                id: groupId,
                name: groupInfo.group,
                isMissingKinkGroup: false,
                kinks: new Set<KinkInfo>()
            };
            for (let item of groupInfo.items) {
                const k: KinkInfo = {
                    id: item.kink_id,
                    name: item.name,
                    description: item.description,
                    isMissingKink: false,
                    kinkGroup: g
                };
                g.kinks.add(k);
                kinksById.set(k.id, k);
            }
            groupsById.set(groupId, g);
        }

        return new DefaultKinksSet(groupsById, kinksById);
    }

    private _kinksSetPromiseSource = new PromiseSource<DefaultKinksSet>();

    getKinksSetAsync(cancellationToken: CancellationToken): Promise<KinksSet> {
        return TaskUtils.waitWithCancel(this._kinksSetPromiseSource.promise, cancellationToken);
    }
}

export class DefaultKinksSet implements KinksSet {
    constructor(
        public readonly allKinkGroupsById: ReadonlyMap<number, KinkGroupInfo>,
        public readonly allKinksById: ReadonlyMap<number, KinkInfo>) {
    }

    getKinkGroupById(id: number): KinkGroupInfo {
        const res = this.allKinkGroupsById.get(id);
        if (res) { return res; }

        return MISSING_KINK_GROUP;
    }

    getKinkById(id: number): KinkInfo {
        const res = this.allKinksById.get(id);
        if (res) { return res; }

        return MISSING_KINK;
    }
}