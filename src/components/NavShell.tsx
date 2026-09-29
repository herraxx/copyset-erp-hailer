// Top bar navigation — matches the reference implementation exactly: brand left,
// horizontally-scrollable nav buttons with icon + label + badge count, active item
// highlighted in the primary tone. Below it, a centred "+ Uusi tarjous / + Uusi tilaus"
// action bar. This replaces an earlier left-sidebar layout that was based on a stale
// deployment; the reference's own source confirms a top bar (NAV array in app.js).
import { Box, Flex, Text, Button, HStack } from '@chakra-ui/react';
import { useTheme, useButtonTone } from '../lib/theme';
import { useApp } from '../hailer/use-app';
import { HailerTextDocument } from '../hailer/theme/icons/HailerTextDocument';
import { HailerShoppingCart } from '../hailer/theme/icons/HailerShoppingCart';
import { HailerFolders } from '../hailer/theme/icons/HailerFolders';
import { HailerGroup } from '../hailer/theme/icons/HailerGroup';
import { HailerDataset } from '../hailer/theme/icons/HailerDataset';
import { HailerTeam } from '../hailer/theme/icons/HailerTeam';
import { HailerPayment } from '../hailer/theme/icons/HailerPayment';
import { HailerMail } from '../hailer/theme/icons/HailerMail';
import { HailerInsights } from '../hailer/theme/icons/HailerInsights';
import { HailerAdmin } from '../hailer/theme/icons/HailerAdmin';

export type PageKey =
  | 'tarjoukset'
  | 'tilaukset'
  | 'arkisto'
  | 'asiakkaat'
  | 'tuotteet'
  | 'alihankkijat'
  | 'hinnoittelu'
  | 'markkinointi'
  | 'yllapito'
  | 'dashboard';

type NavEntry = { key: PageKey; label: string; icon: React.ElementType } | 'sep';

// Matches the reference NAV array exactly, left -> right, with the two "|" separators:
// Tarjoukset · Tilaukset · Arkisto | Asiakkaat · Tuotteet & hinnat · Alihankkijat · Markkinointi | Ylläpito · Dashboard
const NAV: NavEntry[] = [
  { key: 'tarjoukset', label: 'Tarjoukset', icon: HailerTextDocument },
  { key: 'tilaukset', label: 'Tilaukset', icon: HailerShoppingCart },
  { key: 'arkisto', label: 'Arkisto', icon: HailerFolders },
  'sep',
  { key: 'asiakkaat', label: 'Asiakkaat', icon: HailerGroup },
  { key: 'tuotteet', label: 'Tuotteet', icon: HailerDataset },
  { key: 'hinnoittelu', label: 'Hinnoittelu', icon: HailerPayment },
  { key: 'alihankkijat', label: 'Alihankkijat', icon: HailerTeam },
  { key: 'markkinointi', label: 'Markkinointi', icon: HailerMail },
  'sep',
  { key: 'yllapito', label: 'Ylläpito', icon: HailerAdmin },
  { key: 'dashboard', label: 'Dashboard', icon: HailerInsights },
];

interface NavShellProps {
  page: PageKey;
  onNavigate: (page: PageKey) => void;
  onNewOffer: () => void;
  onNewOrder: () => void;
  counts?: Partial<Record<PageKey, number>>;
  children: React.ReactNode;
}

function NewOfferButton({ onClick }: { onClick: () => void }) {
  const t = useButtonTone('act:new-offer', 'Oranssi');
  return (
    <Button h="42px" minW="150px" px="18px" borderRadius="10px" fontSize="13px" fontWeight={800} bg={t.bg} color={t.color} _hover={{ filter: 'brightness(0.95)' }} onClick={onClick}>
      + Uusi tarjous
    </Button>
  );
}
function NewOrderButton({ onClick }: { onClick: () => void }) {
  const t = useButtonTone('act:new-order', 'Oranssi');
  return (
    <Button h="42px" minW="150px" px="18px" borderRadius="10px" fontSize="13px" fontWeight={800} bg={t.bg} color={t.color} _hover={{ filter: 'brightness(0.95)' }} onClick={onClick}>
      + Uusi tilaus
    </Button>
  );
}

export default function NavShell({ page, onNavigate, onNewOffer, onNewOrder, counts, children }: NavShellProps) {
  const { tones, bg } = useTheme();
  const isAdmin = useApp((s) => s.isAdmin);
  const activeTone = tones.Oranssi;

  return (
    <Flex direction="column" minH="100vh" bg={bg.sivu} maxW="100vw" overflowX="hidden">
      <Box bg={bg.ylavalikko} borderBottom="1px solid #DAD7D2" position="sticky" top={0} zIndex={20}>
        <Flex align="center" gap="16px" px={{ base: '12px', md: '20px' }} minH={{ base: '58px', md: '66px' }}>
          <Flex align="center" gap="10px" flex="none">
            <Box w="26px" h="26px" borderRadius="full" border="2px solid #2A2A2A" position="relative" flexShrink={0}>
              <Box position="absolute" top="50%" left="50%" transform="translate(-50%,-50%)" w="8px" h="8px" borderRadius="full" bg={activeTone} />
            </Box>
            <Text fontWeight={800} fontSize="20px" letterSpacing="-0.01em" display={{ base: 'none', lg: 'block' }}>
              Copy-Set
            </Text>
          </Flex>
          <HStack
            spacing="8px"
            flex={1}
            overflowX="auto"
            py="10px"
            css={{ scrollbarWidth: 'none', '&::-webkit-scrollbar': { display: 'none' } }}
          >
            {NAV.filter((n) => n === 'sep' || n.key !== 'yllapito' || isAdmin).map((entry, i) => {
              if (entry === 'sep') {
                return <Box key={`sep-${i}`} flex="none" w="1px" h="36px" bg="#CFCBC5" mx="2px" />;
              }
              const active = entry.key === page;
              const Icon = entry.icon;
              const count = counts?.[entry.key];
              return (
                <Button
                  key={entry.key}
                  onClick={() => onNavigate(entry.key)}
                  variant="unstyled"
                  position="relative"
                  flex="none"
                  minW="66px"
                  display="flex"
                  flexDirection="column"
                  alignItems="center"
                  justifyContent="center"
                  gap="3px"
                  h="auto"
                  px="10px"
                  py="7px"
                  borderRadius="12px"
                  fontSize="12.5px"
                  fontWeight={active ? 800 : 600}
                  color={active ? '#2A2A2A' : '#3A3D42'}
                  bg={active ? activeTone : 'rgba(255,255,255,0.6)'}
                  border="1px solid"
                  borderColor={active ? 'transparent' : 'rgba(0,0,0,0.06)'}
                  boxShadow={active ? '0 2px 6px rgba(0,0,0,.12)' : 'none'}
                  _hover={{ bg: active ? activeTone : 'white' }}
                >
                  <Icon boxSize={5} color={active ? '#2A2A2A' : '#6B6F75'} />
                  <Text as="span" whiteSpace="nowrap">
                    {entry.label}
                  </Text>
                  {count != null && (
                    <Box
                      position="absolute"
                      top="-7px"
                      right="-5px"
                      fontSize="11px"
                      fontWeight={800}
                      color="white"
                      bg={count ? '#3A3D42' : '#B9B6B1'}
                      border="2px solid"
                      borderColor={active ? activeTone : bg.ylavalikko}
                      borderRadius="99px"
                      px="6px"
                      minW="20px"
                      textAlign="center"
                      lineHeight="16px"
                    >
                      {count}
                    </Box>
                  )}
                </Button>
              );
            })}
          </HStack>
        </Flex>
      </Box>

      <Flex bg={bg.kortti} borderBottom="1px solid #E2DFDA" px={{ base: '12px', md: '32px' }} py="12px" justify="center" gap="12px" wrap="wrap">
        <NewOfferButton onClick={onNewOffer} />
        <NewOrderButton onClick={onNewOrder} />
      </Flex>

      <Box flex={1} px={{ base: '12px', md: '32px' }} py={{ base: '16px', md: '26px' }} maxW="1500px" w="100%" mx="auto">
        {children}
      </Box>
    </Flex>
  );
}
