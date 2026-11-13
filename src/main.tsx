import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

const AssetLab = lazy(() => import("./AssetLab"));
const showArtLab = new URLSearchParams(window.location.search).has("artlab");

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {showArtLab ? (
      <Suspense fallback={<div style={{padding:32,color:"#f0d8a1"}}>Opening SL Ravan Art Lab...</div>}>
        <AssetLab/>
      </Suspense>
    ) : <App/>}
  </React.StrictMode>
);
