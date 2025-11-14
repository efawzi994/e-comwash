// components/utils.jsx
import { useState, useEffect } from "react";
import { get } from "@/api/http"; // <-- our HTTP helper (no Base44)

// Settings hook that loads from /api/settings (with safe defaults)
export function useSettings() {
  const [settings, setSettings] = useState({
    company_name: "E-COMWash",
    default_currency: "AED",
    default_tax_rate: 5,
    fiscal_year_start: "01-01",
    tax_enabled: true,
    loyalty_enabled: true,
    auto_invoice: false,
    low_stock_threshold: 10,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const data = await get("/api/settings"); // <-- your API
        setSettings((prev) => ({ ...prev, ...(data || {}) }));
      } catch (e) {
        setError(e?.message || "Failed to load settings");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return { settings, loading, error, refresh: async () => {
    setLoading(true);
    try {
      const data = await get("/api/settings");
      setSettings((prev) => ({ ...prev, ...(data || {}) }));
    } catch (e) {
      setError(e?.message || "Failed to refresh settings");
    } finally {
      setLoading(false);
    }
  }};
}

// Currency formatter (kept API-compatible for CurrencyDisplay)
export function formatCurrency(amount, currency = "AED") {
  const currencyConfig = {
    USD: { symbol: "$", position: "before", decimals: 2 },
    EUR: { symbol: "€", position: "after", decimals: 2 },
    GBP: { symbol: "£", position: "before", decimals: 2 },
    SAR: { symbol: "ر.س", position: "after", decimals: 2 },
    AED: { symbol: "د.إ", position: "after", decimals: 2 },
    JPY: { symbol: "¥", position: "before", decimals: 0 },
    CNY: { symbol: "¥", position: "before", decimals: 2 },
    INR: { symbol: "₹", position: "before", decimals: 2 },
  };

  const cfg = currencyConfig[currency] || { symbol: currency, position: "before", decimals: 2 };
  const n = Number(amount || 0);
  const formatted = n.toFixed(cfg.decimals);

  return cfg.position === "after" ? `${formatted} ${cfg.symbol}` : `${cfg.symbol}${formatted}`;
}

// Page URL helper (unchanged)
export function createPageUrl(pageName) {
  return "/" + pageName.toLowerCase().replace(/ /g, "-");
}
