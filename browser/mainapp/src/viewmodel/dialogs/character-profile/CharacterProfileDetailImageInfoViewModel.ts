import { ImageInfo } from "../../../fchat/api/FListApi";
import { ObservableBase, observableProperty } from "../../../util/ObservableBase";
import { URLUtils } from "../../../util/URLUtils";
import { ActiveLoginViewModel } from "../../ActiveLoginViewModel";


export class CharacterProfileDetailImageInfoViewModel extends ObservableBase {
    constructor(
        private readonly activeLoginViewModel: ActiveLoginViewModel,
        imageInfo: ImageInfo
    ) {
        super();

        const urls = URLUtils.getProfileImageUrls(imageInfo);
        this.thumbnailUrl = urls.thumbnailUrl;
        this.fullUrl = urls.fullUrl;
        this.description = imageInfo.description;
    }

    @observableProperty
    thumbnailUrl: string;

    @observableProperty
    fullUrl: string;

    @observableProperty
    description: string;

    click() {
        this.activeLoginViewModel.bbcodeSink.webpageClick(this.fullUrl, false, {
            rightClick: false,
            channelContext: null,
            targetElement: null
        });
    }
}
