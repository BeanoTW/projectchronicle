import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface DeleteAttachmentDialogProps {
  open: boolean;
  fileName?: string;
  isTranscriptSource: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  busy?: boolean;
}

/**
 * Neutral, deliberate confirmation for attachment deletion.
 * - Standard copy for normal attachments
 * - Stronger copy when the attachment is the source for a transcript
 */
const DeleteAttachmentDialog = ({
  open,
  fileName,
  isTranscriptSource,
  onCancel,
  onConfirm,
  busy = false,
}: DeleteAttachmentDialogProps) => {
  return (
    <AlertDialog open={open} onOpenChange={(o) => { if (!o && !busy) onCancel(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {isTranscriptSource ? 'Delete transcript source file?' : 'Delete attachment?'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {isTranscriptSource ? (
              <>
                This attachment is referenced as the source for a transcript.
                Deleting it will remove the original source file for that transcript.
                The transcript text will be kept on the record.
              </>
            ) : (
              <>This will remove the file from your record and storage.</>
            )}
            {fileName && (
              <span className="block mt-2 text-foreground/80 text-[12px] truncate">{fileName}</span>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel} disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            disabled={busy}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {busy ? 'Deleting…' : isTranscriptSource ? 'Delete anyway' : 'Delete'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default DeleteAttachmentDialog;
