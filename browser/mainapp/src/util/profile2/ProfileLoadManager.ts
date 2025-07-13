import { FListAuthenticatedApi } from "../../fchat/api/FListApi";
import { CharacterName } from "../../shared/CharacterName";
import { CancellationToken, CancellationTokenSource } from "../CancellationTokenSource";
import { asDisposable, IDisposable } from "../Disposable";
import { HostInterop } from "../HostInterop";
import { ManualResetEvent } from "../ManualResetEvent";
import { RateLimiter } from "../RateLimiter";
import { TaskUtils } from "../TaskUtils";

export class ProfileLoadManager implements IDisposable {
    constructor(public readonly flistApi: FListAuthenticatedApi) {
    }

    private _disposedCTS = new CancellationTokenSource();
    private _isDisposed = false;
    get isDisposed(): boolean { return this._isDisposed; }

    dispose(): void {
        if (!this._isDisposed) {
            this._isDisposed = true;
            this._disposedCTS.cancel();
        }
    }
    [Symbol.dispose](): void {
        this.dispose();
    }

    private _extantProfileUpdaters: Map<CharacterName, WeakRef<DefaultProfileUpdater>> = new Map();
    
    getProfileUpdater(characterName: CharacterName) {
        const existingProfileUpdaterRef = this._extantProfileUpdaters.get(characterName);
        if (existingProfileUpdaterRef) {
            const existingProfileUpdater = existingProfileUpdaterRef.deref() ?? null;
            if (existingProfileUpdater) {
                return existingProfileUpdater;
            }
        }

        const newProfileUpdater = new DefaultProfileUpdater(this, characterName);
        this._extantProfileUpdaters.set(characterName, new WeakRef(newProfileUpdater));
        return newProfileUpdater;
    }

    private _hasProfiles: ManualResetEvent = new ManualResetEvent();

    private async processingLoop(): Promise<void> {
        while (!this._disposedCTS.isCancellationRequested) {
            await this._hasProfiles.waitAsync(this._disposedCTS.token);

            const currentProfileUpdater = this.getHighestPriorityProfileUpdater();
            if (currentProfileUpdater != null) {
                await currentProfileUpdater.actuallyGetProfileAsync(this._disposedCTS.token);
            }

            await TaskUtils.delay(1000, this._disposedCTS.token);
        }
    }

    private getHighestPriorityProfileUpdater(): DefaultProfileUpdater | null {
        let highestImportance = 0;
        let highestUpdater: DefaultProfileUpdater | null = null;

        let charactersToRemove: CharacterName[] | null = null;
        for (let characterName of this._extantProfileUpdaters.keys()) {
            const puref = this._extantProfileUpdaters.get(characterName)!;
            const pu = puref.deref();
            if (pu) {
                const puImportance = pu.getUpdateImportance();
                if (puImportance > highestImportance) {
                    highestImportance = puImportance;
                    highestUpdater = pu;
                }
            }
            else {
                charactersToRemove ??= [];
                charactersToRemove.push(characterName);
            }
        }

        if (charactersToRemove) {
            charactersToRemove.forEach(cn => {
                this._extantProfileUpdaters.delete(cn);
            });
        }

        return highestUpdater;
    }
}

export enum ProfileUsageType {
    OPENING_PROFILE_TAB = 10,
    REFRESHING_OWN_PROFILE = 9,
    PROFILE_POPUP_VIEW = 8,
    RECEIVED_PM_FROM = 7,
    SPOKE_IN_CURRENT_TAB = 6,
    LOOKING_IN_CURRENT_TAB = 5,
    PRESENT_IN_CURRENT_TAB = 4,
    FRIEND = 3,
    BOOKMARK = 2,

    NONE = 0
}

export interface ProfileUpdater {
    readonly characterName: CharacterName;
    readonly profile: CharacterProfile | null;
    addUsageBasedListener(usageType: ProfileUsageType, updateCallback: (profileData: CharacterProfile | null) => void): IDisposable;
}

export interface CharacterProfile {
    characterName: CharacterName;
}

const profileUpdateRateLimiter = new RateLimiter(10, 10, 1, 1000);

class DefaultProfileUpdater implements ProfileUpdater {
    constructor(
        private readonly profileLoadManager: ProfileLoadManager,
        public readonly characterName: CharacterName) {

        // TODO: need to initialize value from cache
    }

    private _profile: CharacterProfile | null = null;
    get profile(): CharacterProfile | null { return this._profile; }

    private _currentUsages: Set<{ usageType: ProfileUsageType, updateCallback: (profileData: CharacterProfile | null) => void }> = new Set();

    addUsageBasedListener(usageType: ProfileUsageType, updateCallback: (profileData: CharacterProfile | null) => void): IDisposable {
        const usageRef = { usageType: usageType, updateCallback: updateCallback };
        this._currentUsages.add(usageRef);

        return asDisposable(() => {
            this._currentUsages.delete(usageRef);
        });
    }

    getUpdateImportance(): number {
        let minUsageType: ProfileUsageType = ProfileUsageType.NONE;
        this._currentUsages.forEach(r => minUsageType = Math.min(minUsageType, r.usageType));
        // TODO: need to adjust importance based on cache age
        return minUsageType;
    }

    async actuallyGetProfileAsync(cancellationToken: CancellationToken): Promise<CharacterProfile | null> {
        await profileUpdateRateLimiter.waitAsync(1, cancellationToken);
        const pi = this.profileLoadManager.flistApi.getCharacterProfileAsync(this.characterName, cancellationToken);
    }
}