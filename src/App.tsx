import { useEffect, useState } from 'react';
import { Box, Text, useToast } from '@chakra-ui/react';
import { useApp } from './hailer/use-app';
import NavShell, { PageKey } from './components/NavShell';
import TarjouksetPage from './pages/TarjouksetPage';
import TilauksetPage from './pages/TilauksetPage';
import ArchivePage from './pages/ArchivePage';
import AsiakkaatPage from './pages/AsiakkaatPage';
import TuotteetPage from './pages/TuotteetPage';
import AlihankkijatPage from './pages/AlihankkijatPage';
import HinnoitteluPage, { PricingResult } from './pages/HinnoitteluPage';
import MarkkinointiPage from './pages/MarkkinointiPage';
import DashboardPage from './pages/DashboardPage';
import YllapitoPage from './pages/YllapitoPage';
import { createOrderFromOffer } from './lib/orderFromOffer';
import { ThemeProvider } from './lib/theme';
import { useNavCounts } from './lib/useNavCounts';

export default function App() {
  const { hailer, api, inside } = useApp();
  const toast = useToast();
  const [page, setPage] = useState<PageKey>('tilaukset');

  const [focusOfferId, setFocusOfferId] = useState<string | null>(null);
  const [focusOrderId, setFocusOrderId] = useState<string | null>(null);
  const [presetCustomerId, setPresetCustomerId] = useState<string | null>(null);
  const [requestNewOffer, setRequestNewOffer] = useState(false);
  const [requestNewOrder, setRequestNewOrder] = useState(false);
  const [pendingLine, setPendingLine] = useState<PricingResult | null>(null);
  const [converting, setConverting] = useState(false);
  // Bump after any mutation that changes a badge count (offer/order created,
  // accepted, invoiced, deleted...) so the nav refetches instead of polling.
  const [navRefresh, setNavRefresh] = useState(0);
  const navCounts = useNavCounts(hailer, navRefresh);

  useEffect(() => {
    void api.init();
  }, [api]);

  // Refetch nav badge counts on every navigation — cheap for this data size
  // and keeps counts honest after mutations made on whatever page you left.
  useEffect(() => {
    setNavRefresh((r) => r + 1);
  }, [page]);

  async function handleCreateOrderFromOffer(offerId: string, startProduction = false) {
    if (!hailer) return;
    setConverting(true);
    try {
      const orderId = await createOrderFromOffer(hailer, offerId, startProduction);
      toast({ title: 'Tilaus luotu tarjouksesta.', status: 'success' });
      setPage('tilaukset');
      setFocusOrderId(orderId);
    } catch (e) {
      toast({ title: 'Tilauksen luonti epäonnistui', description: String((e as Error)?.message || e), status: 'error' });
    } finally {
      setConverting(false);
    }
  }

  function handleCreateOfferForCustomer(customerId: string) {
    setPresetCustomerId(customerId);
    setPage('tarjoukset');
    setRequestNewOffer(true);
  }

  function handleTransferPricingToOffer(result: PricingResult) {
    setPendingLine(result);
    setPage('tarjoukset');
    setRequestNewOffer(true);
  }

  // Matches the reference's "Tee tarjous" product-card button (quoteFor):
  // jumps straight to a new offer pre-filled with this product at qty 500.
  function handleQuoteForProduct(product: { id: string; name: string; perushinta: number; aloitusmaksu: number }) {
    setPendingLine({
      tuoteId: product.id,
      tuoteNimi: product.name,
      maara: 500,
      yksikkohinta: product.perushinta,
      aloitusmaksu: product.aloitusmaksu,
      lisatyoNimi: '',
      lisatyoHinta: 0,
      toimitushinta: 0,
      netto: product.perushinta * 500 + product.aloitusmaksu,
      alv: 0,
      brutto: 0,
    });
    setPage('tarjoukset');
    setRequestNewOffer(true);
  }

  if (!inside) {
    return (
      <Box p={10} textAlign="center">
        <Text fontSize="lg" color="subtleText">
          Avaa CopySet ERP Hailerin sisällä.
        </Text>
      </Box>
    );
  }

  if (!hailer) {
    return (
      <Box p={10} textAlign="center">
        <Text color="subtleText">Yhdistetään Haileriin…</Text>
      </Box>
    );
  }

  return (
    <ThemeProvider hailer={hailer}>
    <NavShell
      page={page}
      onNavigate={setPage}
      counts={navCounts}
      onNewOffer={() => {
        setPresetCustomerId(null);
        setPendingLine(null);
        setPage('tarjoukset');
        setRequestNewOffer(true);
      }}
      onNewOrder={() => {
        setPresetCustomerId(null);
        setPage('tilaukset');
        setRequestNewOrder(true);
      }}
    >
      {converting && (
        <Box mb={4} p={3} borderRadius="10px" bg="blue.50" color="blue.700" fontSize="sm">
          Luodaan tilaus tarjouksesta…
        </Box>
      )}

      {page === 'tarjoukset' && (
        <TarjouksetPage
          hailer={hailer}
          onCreateOrderFromOffer={handleCreateOrderFromOffer}
          focusOfferId={focusOfferId}
          onFocusHandled={() => setFocusOfferId(null)}
          presetCustomerId={presetCustomerId}
          onOpenNewRequested={requestNewOffer}
          onNewHandled={() => {
            setRequestNewOffer(false);
            setPresetCustomerId(null);
          }}
          prefillLine={pendingLine}
          onPrefillHandled={() => setPendingLine(null)}
        />
      )}

      {page === 'tilaukset' && (
        <TilauksetPage
          hailer={hailer}
          focusOrderId={focusOrderId}
          onFocusHandled={() => setFocusOrderId(null)}
          presetCustomerId={presetCustomerId}
          onOpenNewRequested={requestNewOrder}
          onNewHandled={() => {
            setRequestNewOrder(false);
            setPresetCustomerId(null);
          }}
        />
      )}

      {page === 'arkisto' && <ArchivePage hailer={hailer} />}

      {page === 'asiakkaat' && <AsiakkaatPage hailer={hailer} onCreateOfferForCustomer={handleCreateOfferForCustomer} />}

      {page === 'tuotteet' && <TuotteetPage hailer={hailer} onQuoteForProduct={handleQuoteForProduct} />}
      {page === 'alihankkijat' && <AlihankkijatPage hailer={hailer} />}
      {page === 'hinnoittelu' && <HinnoitteluPage hailer={hailer} onTransferToOffer={handleTransferPricingToOffer} />}
      {page === 'markkinointi' && <MarkkinointiPage hailer={hailer} />}
      {page === 'yllapito' && <YllapitoPage hailer={hailer} />}
      {page === 'dashboard' && <DashboardPage hailer={hailer} />}
    </NavShell>
    </ThemeProvider>
  );
}
