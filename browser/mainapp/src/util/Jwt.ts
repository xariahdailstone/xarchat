
export class Jwt {
    static isValidJwt(potentialToken: string | null | undefined): boolean {
        if (!potentialToken) { return false; }
        const parts = potentialToken.split('.');
        if (parts.length != 3) { return false; }

        try {
            const payload = this.decodeJwtPayload(potentialToken);
            return (payload["iss"] && payload["exp"]);
        }
        catch {
            return false;
        }
    }

    private static decodeJwtPayload(token: string): { [name: string]: any } {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(
            atob(base64)
                .split('')
                .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                .join('')
        );
        return JSON.parse(jsonPayload);
    }

    constructor(token: string) {
        if (!Jwt.isValidJwt(token)) {
            throw new Error("Invalid JWT");
        }

        const payload = Jwt.decodeJwtPayload(token);
        this.payload = payload;
    }

    private readonly payload: { [name: string]: any };

    hasClaim(claim: string): boolean {
        return this.payload[claim] != null;
    }

    getClaim(claim: string): any {
        return this.payload[claim];
    }
}