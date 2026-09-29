import { useRef } from 'react';
import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogOverlay,
  Button,
} from '@chakra-ui/react';
import { brand } from '../theme/brand';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  body: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmColorScheme?: string;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  isOpen,
  title,
  body,
  confirmLabel = 'Vahvista',
  cancelLabel = 'Peruuta',
  confirmColorScheme = 'green',
  isLoading,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <AlertDialog isOpen={isOpen} onClose={onCancel} trapFocus={false} autoFocus={false} leastDestructiveRef={cancelRef}>
      <AlertDialogOverlay />
      <AlertDialogContent borderRadius="12px">
        <AlertDialogHeader>{title}</AlertDialogHeader>
        <AlertDialogBody>{body}</AlertDialogBody>
        <AlertDialogFooter>
          <Button ref={cancelRef} onClick={onCancel} variant="ghost" mr={3} h="40px" isDisabled={isLoading}>
            {cancelLabel}
          </Button>
          <Button
            onClick={onConfirm}
            colorScheme={confirmColorScheme}
            h="40px"
            isLoading={isLoading}
            bg={confirmColorScheme === 'orange' ? brand.orange : undefined}
            color={confirmColorScheme === 'orange' ? brand.charcoal : undefined}
          >
            {confirmLabel}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
