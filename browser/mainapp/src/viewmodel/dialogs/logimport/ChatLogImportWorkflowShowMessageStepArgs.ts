import { ChatLogImportWorkflowShowMessageButton } from "./ChatLogImportWorkflowShowMessageButton";


export interface ChatLogImportWorkflowShowMessageStepArgs {
    readonly title: string;
    readonly body: string;
    readonly buttons: ChatLogImportWorkflowShowMessageButton[];
}
