import { Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Home from './pages/Home';
import Blocks from './pages/Blocks';
import BlockDetail from './pages/BlockDetail';
import Transactions from './pages/Transactions';
import TxDetail from './pages/TxDetail';
import Address from './pages/Address';
import Validators from './pages/Validators';
import ValidatorDetail from './pages/ValidatorDetail';
import DeFi from './pages/DeFi';
import Governance from './pages/Governance';
import GovernanceDetail from './pages/GovernanceDetail';
import RWA from './pages/RWA';
import RWADetail from './pages/RWADetail';
import NFTs from './pages/NFTs';
import NFTDetail from './pages/NFTDetail';
import NotFound from './pages/NotFound';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/"                       element={<Home />} />
        <Route path="/blocks"                 element={<Blocks />} />
        <Route path="/block/:param"           element={<BlockDetail />} />
        <Route path="/transactions"           element={<Transactions />} />
        <Route path="/tx/:hash"               element={<TxDetail />} />
        <Route path="/address/:addr"          element={<Address />} />
        <Route path="/validators"             element={<Validators />} />
        <Route path="/validator/:addr"        element={<ValidatorDetail />} />
        <Route path="/defi"                   element={<DeFi />} />
        <Route path="/governance"             element={<Governance />} />
        <Route path="/governance/:id"         element={<GovernanceDetail />} />
        <Route path="/rwa"                    element={<RWA />} />
        <Route path="/rwa/:id"                element={<RWADetail />} />
        <Route path="/nfts"                   element={<NFTs />} />
        <Route path="/nft/:id"                element={<NFTDetail />} />
        <Route path="*"                       element={<NotFound />} />
      </Routes>
    </Layout>
  );
}
