import { HashRouter, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import Landing from "./routes/Landing";
import HashLab from "./routes/HashLab";
import CommitmentLab from "./routes/CommitmentLab";
import MerkleLab from "./routes/MerkleLab";
import SignatureLab from "./routes/SignatureLab";
import SchnorrLab from "./routes/SchnorrLab";
import ZKColoringLab from "./routes/ZKColoringLab";
import Toolkit from "./routes/Toolkit";
import About from "./routes/About";

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Landing />} />
          <Route path="hash" element={<HashLab />} />
          <Route path="commitments" element={<CommitmentLab />} />
          <Route path="merkle" element={<MerkleLab />} />
          <Route path="signatures" element={<SignatureLab />} />
          <Route path="schnorr" element={<SchnorrLab />} />
          <Route path="zero-knowledge" element={<ZKColoringLab />} />
          <Route path="toolkit" element={<Toolkit />} />
          <Route path="about" element={<About />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
