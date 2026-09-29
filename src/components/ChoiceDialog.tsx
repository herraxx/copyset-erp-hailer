// Matches the reference's choiceBox() — a vertical stack of full-width option
// buttons instead of a simple yes/no confirm. Used for "Merkitse hyväksytyksi"
// (Hyväksy ja luo tilaus / Hyväksy ja aloita tuotanto heti / Vain hyväksy / Peruuta).
import { useRef } from 'react';
import {
  AlertDialog,
  AlertDialogBody,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogOverlay,
  AlertDialogFooter,
  Button,
  Text,
  VStack,
} from '@chakra-ui/react';
import { useButtonTone, type ToneKey } from '../lib/theme';

export interface ChoiceOption<T extends string> {
  value: T;
  label: string;
  tone: ToneKey;
  buttonKey: string;
}

interface ChoiceDialogProps<T extends string> {
  isOpen: boolean;
  title: string;
  body: React.ReactNode;
  options: ChoiceOption<T>[];
  isLoading?: boolean;
  onChoose: (value: T) => void;
  onCancel: () => void;
}

function ChoiceButton<T extends string>({ opt, isLoading, onChoose }: { opt: ChoiceOption<T>; isLoading?: boolean; onChoose: (v: T) => void }) {
  const t = useButtonTone(opt.buttonKey, opt.tone);
  return (
    <Button
      w="100%"
      justifyContent="flex-start"
      h="46px"
      px="16px"
      borderRadius="10px"
      fontWeight={700}
      bg={t.bg}
      color={t.color}
      border={t.borderColor ? '1.5px solid' : undefined}
      borderColor={t.borderColor}
      isDisabled={isLoading}
      _hover={{ filter: 'brightness(0.95)' }}
      onClick={() => onChoose(opt.value)}
    >
      {opt.label}
    </Button>
  );
}

export default function ChoiceDialog<T extends string>({ isOpen, title, body, options, isLoading, onChoose, onCancel }: ChoiceDialogProps<T>) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <AlertDialog isOpen={isOpen} onClose={onCancel} trapFocus={false} autoFocus={false} leastDestructiveRef={cancelRef}>
      <AlertDialogOverlay />
      <AlertDialogContent borderRadius="12px" maxW="460px">
        <AlertDialogHeader>{title}</AlertDialogHeader>
        <AlertDialogBody>
          {typeof body === 'string' ? <Text fontSize="sm" color="subtleText" mb={3}>{body}</Text> : <>{body}</>}
          <VStack align="stretch" spacing="8px" mt={2}>
            {options.map((opt) => (
              <ChoiceButton key={opt.value} opt={opt} isLoading={isLoading} onChoose={onChoose} />
            ))}
          </VStack>
        </AlertDialogBody>
        <AlertDialogFooter pt={0}>
          <Button ref={cancelRef} onClick={onCancel} variant="ghost" isDisabled={isLoading} w="100%">
            Peruuta
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
