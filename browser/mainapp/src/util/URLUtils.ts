import { ImageInfo, InlineInfo } from "../fchat/api/FListApi";
import { CharacterName } from "../shared/CharacterName";
import { CancellationToken } from "./CancellationTokenSource";
import { HostInterop } from "./HostInterop";

export class URLUtils {

    static getAvatarImageUrl(character: CharacterName): string {
        const urlPart = encodeURIComponent(character.value.toLowerCase());
        return `https://static.f-list.net/images/avatar/${urlPart}.png`;
    }

    static getInlineImageUrl(iinfo: InlineInfo): string {
        // https://static.f-list.net/images/charinline/f6/58/f65801cbc4a92636d46abd797c8599c28c804be8.png
        const hash = iinfo.hash;
        const hash12 = hash.substr(0, 2);
        const hash34 = hash.substr(2, 2);
        const extension = iinfo.extension;
        const url = `https://static.f-list.net/images/charinline/${hash12}/${hash34}/${hash}.${extension}`;
        return url;
    }

    static getProfileImageUrls(imgInfo: ImageInfo): { thumbnailUrl: string, fullUrl: string } {
        return {
            thumbnailUrl: `https://static.f-list.net/images/charthumb/${imgInfo.image_id}.${imgInfo.extension}`,
            fullUrl: `https://static.f-list.net/images/charimage/${imgInfo.image_id}.${imgInfo.extension}`
        };
    }

    static tryGetProfileLinkTarget(url: string): string | null {
        const urlLinkPrefix = "https://www.f-list.net/c/";
        if (url.toLowerCase().startsWith(urlLinkPrefix)) {
            return decodeURIComponent(url.substring(urlLinkPrefix.length));
        }
        else {
            return null;
        }
    }

    static getProfileUrl(character: CharacterName): string {
        return `https://www.f-list.net/c/${character.canonicalValue}`;
    }

    static getEIconUrl(name: string, addUniqueTag: (string | null) = null): string {
        const rawUrl = this.getEIconUrlInternal(name, addUniqueTag);
        const canonicalUrl = `https://static.f-list.net/images/eicon/${encodeURIComponent(name.toLowerCase())}.gif`;
        return `${rawUrl}#canonicalUrl=${encodeURIComponent(canonicalUrl)}`;
    }

    static getEIconUrlInternal(name: string, addUniqueTag: (string | null) = null): string {
        const url = `/api/eicon/${encodeURIComponent(name.toLowerCase())}`;
        //const url = `https://static.f-list.net/images/eicon/${encodeURIComponent(name.toLowerCase())}.gif`;
        if (addUniqueTag) {
            if (url.indexOf("?") != -1) {
                return `${url}&_uniq=${addUniqueTag}`;
            }
            else {
                return `${url}?_uniq=${addUniqueTag}`;
            }
        }
        else {
            return url;
        }
    }

    static getDirectEIconUrl(name: string, addUniqueTag: (string | null) = null): string {
        //const url = `/api/eicon/${encodeURIComponent(name.toLowerCase())}`;
        const url = `https://static.f-list.net/images/eicon/${encodeURIComponent(name.toLowerCase())}.gif`;
        // if (addUniqueTag) {
        //     if (url.indexOf("?") != -1) {
        //         return `${url}&_uniq=${addUniqueTag}`;
        //     }
        //     else {
        //         return `${url}?_uniq=${addUniqueTag}`;
        //     }
        // }
        // else {
            return url;
        //}
    }

    private static getImageProxyUrl(imageUrl: string, loadAs: ("ssimage" | "document")) {
        if (HostInterop.isInXarChatHost) {
            const u = new URL(imageUrl);
            const pathParts = u.pathname.split('/');
            const lastPathPart = pathParts[pathParts.length - 1];
            return `/api/proxyImageUrl/${encodeURIComponent(lastPathPart)}?url=${encodeURIComponent(imageUrl)}&loadAs=${loadAs}#canonicalUrl=${encodeURIComponent(imageUrl)}`;
        }
        else {
            return null;
        }
    }

    static async getLinkedImagePreviewUrlAsync(linkUrl: string, cancellationToken?: CancellationToken): Promise<string | null> {
        const uri = new URL(linkUrl);
        const uriPath = uri.pathname;

        if (uri.host == "wimg.rule34.xxx") {
            return this.getImageProxyUrl(linkUrl, "ssimage");
        }
        if (uriPath.endsWith(".gif") || uriPath.endsWith(".png") || uriPath.endsWith(".jpg") || uriPath.endsWith(".jpeg") || uriPath.endsWith(".webp")) {
            if (uri.host.endsWith("4chan.org")) {
                return this.getImageProxyUrl(linkUrl, "ssimage");
            }

            return linkUrl;
        }
        if (uri.host.endsWith("twimg.com")) {
            return linkUrl;
        }
        
        return null;
    }

    static getNoteUrl(noteId: number) {
        const result = `https://www.f-list.net/view_note.php?note_id=${noteId}`;
        return result;
    }

    static getEmptyImageUrl() {
        return "";
    }
}