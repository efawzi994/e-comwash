
import React, { useState } from "react";
import { get, post } from "@/api/http";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useSettings, formatCurrency } from "@/components/utils";
import {
  FileText,
  Download,
  Printer,
  Package,
  TrendingUp,
  AlertTriangle,
  BarChart3,
  Filter,
  Calendar,
  DollarSign,
  FileDown,
  Target, // New icon
  Activity, // New icon
  Zap, // New icon
  Clock // New icon
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, startOfMonth, endOfMonth, subMonths, parseISO, differenceInDays, addDays } from "date-fns";
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from 'recharts';

export default function InventoryReportsPage() {
  const { settings } = useSettings();
  const currency = settings.default_currency || 'USD';

  const [dateFrom, setDateFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedMovementType, setSelectedMovementType] = useState("all");
  const [selectedCostingMethod, setSelectedCostingMethod] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [forecastDays, setForecastDays] = useState("30"); // New state for forecast period

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list(),
  });

  const { data: stockMovements = [] } = useQuery({
    queryKey: ['stockMovements'],
    queryFn: () => base44.entities.StockMovement.list('-created_date', 1000),
  });

  // === REPORT 1: INVENTORY VALUATION ===
  const generateInventoryValuation = () => {
    let filteredProducts = products;

    // Apply category filter
    if (selectedCategory !== 'all') {
      filteredProducts = filteredProducts.filter(p => p.category === selectedCategory);
    }

    // Apply costing method filter
    if (selectedCostingMethod !== 'all') {
      filteredProducts = filteredProducts.filter(p =>
        (p.costing_method || 'weighted_average') === selectedCostingMethod
      );
    }

    // Apply search filter
    if (searchTerm) {
      filteredProducts = filteredProducts.filter(p =>
        p.product_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filteredProducts.map(product => {
      const currentValue = (product.current_stock || 0) * (product.cost_price || 0);
      const movements = stockMovements.filter(m => m.product_id === product.id);

      // Calculate total purchased and sold
      const totalPurchased = movements
        .filter(m => m.quantity > 0)
        .reduce((sum, m) => sum + m.quantity, 0);

      const totalSold = Math.abs(movements
        .filter(m => m.quantity < 0)
        .reduce((sum, m) => sum + m.quantity, 0));

      // Calculate total COGS
      const totalCOGS = movements
        .filter(m => m.calculated_cogs && m.calculated_cogs > 0)
        .reduce((sum, m) => sum + m.calculated_cogs, 0);

      // Average COGS per unit
      const avgCOGS = totalSold > 0 ? totalCOGS / totalSold : 0;

      // Turnover ratio
      const avgInventory = ((product.current_stock || 0) + totalPurchased) / 2;
      const turnoverRatio = avgInventory > 0 ? totalSold / avgInventory : 0;

      return {
        product_id: product.id,
        product_name: product.product_name,
        sku: product.sku,
        category: product.category || 'Uncategorized',
        product_type: product.product_type,
        costing_method: product.costing_method || 'weighted_average',
        uom: product.uom,
        current_stock: product.current_stock || 0,
        unit_cost: product.cost_price || 0,
        current_value: currentValue,
        total_purchased: totalPurchased,
        total_sold: totalSold,
        total_cogs: totalCOGS,
        avg_cogs: avgCOGS,
        turnover_ratio: turnoverRatio,
        retail_price: product.retail_price || 0,
        potential_revenue: (product.current_stock || 0) * (product.retail_price || 0),
        potential_profit: (product.current_stock || 0) * ((product.retail_price || 0) - (product.cost_price || 0)),
        profit_margin: product.retail_price > 0 ? (((product.retail_price - (product.cost_price || 0)) / product.retail_price) * 100) : 0
      };
    }).sort((a, b) => b.current_value - a.current_value);
  };

  // === REPORT 2: STOCK MOVEMENT HISTORY ===
  const generateStockMovementHistory = () => {
    let filteredMovements = stockMovements;

    // Filter by date range
    filteredMovements = filteredMovements.filter(m => {
      if (!m.movement_date) return false;
      const date = new Date(m.movement_date);
      const from = new Date(dateFrom);
      const to = new Date(dateTo);
      to.setHours(23, 59, 59);
      return date >= from && date <= to;
    });

    // Filter by movement type
    if (selectedMovementType !== 'all') {
      filteredMovements = filteredMovements.filter(m => m.movement_type === selectedMovementType);
    }

    // Filter by category
    if (selectedCategory !== 'all') {
      const categoryProducts = products.filter(p => p.category === selectedCategory).map(p => p.id);
      filteredMovements = filteredMovements.filter(m => categoryProducts.includes(m.product_id));
    }

    // Filter by search term
    if (searchTerm) {
      filteredMovements = filteredMovements.filter(m =>
        m.product_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        m.movement_number?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return filteredMovements.map(movement => {
      const product = products.find(p => p.id === movement.product_id);
      return {
        ...movement,
        product_name: product?.product_name || 'N/A', // Ensure product_name is available
        sku: product?.sku || 'N/A', // Ensure sku is available
        category: product?.category || 'N/A',
        costing_method: movement.costing_method || product?.costing_method || 'N/A',
        movement_date_formatted: movement.movement_date ? format(parseISO(movement.movement_date), 'MMM d, yyyy') : 'N/A',
        created_date_formatted: format(new Date(movement.created_date), 'MMM d, yyyy h:mm a'),
        direction: movement.quantity > 0 ? 'IN' : 'OUT',
        abs_quantity: Math.abs(movement.quantity || 0)
      };
    }).sort((a, b) => new Date(b.movement_date || b.created_date).getTime() - new Date(a.movement_date || a.created_date).getTime());
  };

  // === REPORT 3: LOW STOCK ALERT ===
  const generateLowStockReport = () => {
    let lowStockProducts = products.filter(p =>
      p.current_stock <= p.min_stock_level &&
      p.min_stock_level > 0 &&
      p.status === 'active'
    );

    // Apply category filter
    if (selectedCategory !== 'all') {
      lowStockProducts = lowStockProducts.filter(p => p.category === selectedCategory);
    }

    // Apply search filter
    if (searchTerm) {
      lowStockProducts = lowStockProducts.filter(p =>
        p.product_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return lowStockProducts.map(product => {
      const stockPercentage = product.min_stock_level > 0
        ? (product.current_stock / product.min_stock_level) * 100
        : 0;

      const isCritical = product.current_stock <= (product.min_stock_level * 0.5);
      const shortage = Math.max(0, (product.min_stock_level || 0) - (product.current_stock || 0));
      const reorderQty = product.reorder_quantity || product.min_stock_level || 0;
      const reorderCost = reorderQty * (product.cost_price || 0);

      // Days since last purchase
      const lastPurchase = stockMovements
        .filter(m => m.product_id === product.id && m.quantity > 0)
        .sort((a, b) => new Date(b.movement_date || b.created_date).getTime() - new Date(a.movement_date || a.created_date).getTime())[0];

      const daysSinceLastPurchase = lastPurchase
        ? differenceInDays(new Date(), new Date(lastPurchase.movement_date || lastPurchase.created_date))
        : null;

      // Average daily consumption
      const consumptionMovements = stockMovements.filter(m =>
        m.product_id === product.id &&
        m.quantity < 0 &&
        m.movement_date
      );

      const periodInDays = differenceInDays(new Date(dateTo), new Date(dateFrom)) +1; // +1 to include start and end day
      const avgDailyConsumption = consumptionMovements.length > 0 && periodInDays > 0
        ? Math.abs(consumptionMovements.reduce((sum, m) => sum + m.quantity, 0)) / periodInDays
        : 0;

      const daysUntilStockout = avgDailyConsumption > 0
        ? Math.floor((product.current_stock || 0) / avgDailyConsumption)
        : null;

      return {
        product_id: product.id,
        product_name: product.product_name,
        sku: product.sku,
        category: product.category || 'Uncategorized',
        costing_method: product.costing_method || 'weighted_average',
        uom: product.uom,
        current_stock: product.current_stock || 0,
        min_stock_level: product.min_stock_level || 0,
        stock_percentage: stockPercentage,
        shortage: shortage,
        is_critical: isCritical,
        priority: isCritical ? 'CRITICAL' : stockPercentage < 25 ? 'HIGH' : stockPercentage < 50 ? 'MEDIUM' : 'LOW',
        reorder_quantity: reorderQty,
        reorder_cost: reorderCost,
        unit_cost: product.cost_price || 0,
        days_since_last_purchase: daysSinceLastPurchase,
        avg_daily_consumption: avgDailyConsumption,
        days_until_stockout: daysUntilStockout
      };
    }).sort((a, b) => {
      // Sort by priority: CRITICAL > HIGH > MEDIUM > LOW
      const priorityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });
  };

  // === REPORT 4: INVENTORY TURNOVER (ENHANCED) ===
  const generateInventoryTurnover = () => {
    let filteredProducts = products;

    // Apply filters
    if (selectedCategory !== 'all') {
      filteredProducts = filteredProducts.filter(p => p.category === selectedCategory);
    }

    if (searchTerm) {
      filteredProducts = filteredProducts.filter(p =>
        p.product_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter movements by date range
    const periodMovements = stockMovements.filter(m => {
      if (!m.movement_date) return false;
      const date = new Date(m.movement_date);
      const from = new Date(dateFrom);
      const to = new Date(dateTo);
      to.setHours(23, 59, 59);
      return date >= from && date <= to;
    });

    return filteredProducts.map(product => {
      const productMovements = periodMovements.filter(m => m.product_id === product.id);

      // Beginning inventory (assume it's current stock + net movements)
      const netMovement = productMovements.reduce((sum, m) => sum + (m.quantity || 0), 0);
      const beginningStock = (product.current_stock || 0) - netMovement;
      const endingStock = product.current_stock || 0;

      // Average inventory
      const avgInventory = (beginningStock + endingStock) / 2;
      const avgInventoryValue = avgInventory * (product.cost_price || 0);

      // COGS for the period
      const periodCOGS = productMovements
        .filter(m => m.calculated_cogs && m.calculated_cogs > 0)
        .reduce((sum, m) => sum + m.calculated_cogs, 0);

      // Quantity sold
      const quantitySold = Math.abs(productMovements
        .filter(m => m.quantity < 0)
        .reduce((sum, m) => sum + m.quantity, 0));

      // Quantity purchased
      const quantityPurchased = productMovements
        .filter(m => m.quantity > 0)
        .reduce((sum, m) => sum + m.quantity, 0);

      // Turnover calculations
      const turnoverRatio = avgInventory > 0 ? quantitySold / avgInventory : 0;
      const turnoverRatioValue = avgInventoryValue > 0 ? periodCOGS / avgInventoryValue : 0;

      // Days in period
      const daysInPeriod = differenceInDays(new Date(dateTo), new Date(dateFrom)) + 1 || 1;

      // Days sales in inventory
      const daysSalesInInventory = turnoverRatio > 0 ? daysInPeriod / turnoverRatio : 999;

      // Sales velocity (units per day)
      const salesVelocity = quantitySold / daysInPeriod;

      // Stock health assessment
      let stockHealth = 'Good';
      if (turnoverRatio < 1) stockHealth = 'Slow-Moving';
      else if (turnoverRatio > 6) stockHealth = 'Fast-Moving';
      else if (turnoverRatio > 3) stockHealth = 'Good';

      // Revenue and profit potential
      const potentialRevenue = quantitySold * (product.retail_price || 0);
      const actualProfit = potentialRevenue - periodCOGS;
      const profitMargin = potentialRevenue > 0 ? (actualProfit / potentialRevenue) * 100 : 0;

      return {
        product_id: product.id,
        product_name: product.product_name,
        sku: product.sku,
        category: product.category || 'Uncategorized',
        costing_method: product.costing_method || 'weighted_average',
        uom: product.uom,
        beginning_stock: beginningStock,
        ending_stock: endingStock,
        avg_inventory: avgInventory,
        avg_inventory_value: avgInventoryValue,
        quantity_purchased: quantityPurchased,
        quantity_sold: quantitySold,
        period_cogs: periodCOGS,
        turnover_ratio: turnoverRatio,
        turnover_ratio_value: turnoverRatioValue,
        days_sales_in_inventory: daysSalesInInventory,
        sales_velocity: salesVelocity,
        stock_health: stockHealth,
        potential_revenue: potentialRevenue,
        actual_profit: actualProfit,
        profit_margin: profitMargin,
        days_in_period: daysInPeriod
      };
    }).filter(p => p.quantity_sold > 0 || p.avg_inventory > 0)
      .sort((a, b) => b.turnover_ratio - a.turnover_ratio);
  };

  // === REPORT 5: INVENTORY FORECAST (NEW!) ===
  const generateInventoryForecast = () => {
    let filteredProducts = products;

    // Apply filters
    if (selectedCategory !== 'all') {
      filteredProducts = filteredProducts.filter(p => p.category === selectedCategory);
    }

    if (searchTerm) {
      filteredProducts = filteredProducts.filter(p =>
        p.product_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    const daysToForecast = parseInt(forecastDays);

    return filteredProducts.map(product => {
      const productMovements = stockMovements.filter(m => m.product_id === product.id);

      // === 1. HISTORICAL CONSUMPTION ANALYSIS ===
      const consumptionMovements = productMovements
        .filter(m => m.quantity < 0 && m.movement_date)
        .sort((a, b) => new Date(a.movement_date).getTime() - new Date(b.movement_date).getTime());

      if (consumptionMovements.length < 5) { // Need at least some movements for meaningful analysis
        return null; // Skip products with insufficient consumption history
      }

      // Calculate consumption over different periods
      const now = new Date();

      const getConsumptionInPeriod = (days) => {
        const movementsInPeriod = consumptionMovements.filter(m =>
          differenceInDays(now, new Date(m.movement_date)) <= days
        );
        return Math.abs(movementsInPeriod.reduce((sum, m) => sum + m.quantity, 0));
      };

      const totalConsumption30 = getConsumptionInPeriod(30);
      const totalConsumption60 = getConsumptionInPeriod(60);
      const totalConsumption90 = getConsumptionInPeriod(90);

      // Average daily consumption for different periods
      const avgDaily30 = totalConsumption30 > 0 ? totalConsumption30 / 30 : 0;
      const avgDaily60 = totalConsumption60 > 0 ? totalConsumption60 / 60 : 0;
      const avgDaily90 = totalConsumption90 > 0 ? totalConsumption90 / 90 : 0;

      // Weighted average (more weight to recent data)
      // Normalize weights if any period has zero consumption or days
      const totalWeight = (avgDaily30 ? 0.5 : 0) + (avgDaily60 ? 0.3 : 0) + (avgDaily90 ? 0.2 : 0);
      const avgDailyConsumption = totalWeight > 0 ?
        ((avgDaily30 * 0.5) + (avgDaily60 * 0.3) + (avgDaily90 * 0.2)) / totalWeight : 0;

      // === 2. TREND ANALYSIS ===
      // Compare recent vs older consumption to detect trends
      const trendIndicator = avgDaily60 > 0
        ? ((avgDaily30 - avgDaily60) / avgDaily60) * 100
        : 0;

      let trend = 'Stable';
      if (trendIndicator > 20) trend = 'Increasing';
      else if (trendIndicator < -20) trend = 'Decreasing';

      // === 3. VARIABILITY ANALYSIS ===
      // Calculate standard deviation of daily consumption
      // Group consumption by day to get daily consumption values
      const dailyConsumptionMap = consumptionMovements.reduce((acc, m) => {
        const dateKey = format(parseISO(m.movement_date), 'yyyy-MM-dd');
        acc[dateKey] = (acc[dateKey] || 0) + Math.abs(m.quantity);
        return acc;
      }, {});
      const dailyConsumptions = Object.values(dailyConsumptionMap);

      let mean = 0;
      let stdDev = 0;
      let variabilityCoefficient = 0;

      if (dailyConsumptions.length > 1) {
        mean = dailyConsumptions.reduce((sum, val) => sum + val, 0) / dailyConsumptions.length;
        const variance = dailyConsumptions.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / dailyConsumptions.length;
        stdDev = Math.sqrt(variance);
        variabilityCoefficient = mean > 0 ? (stdDev / mean) * 100 : 0;
      } else if (dailyConsumptions.length === 1) {
        mean = dailyConsumptions[0];
        stdDev = 0; // No variability with only one data point
        variabilityCoefficient = 0;
      }

      let demandVariability = 'Low';
      if (variabilityCoefficient > 50) demandVariability = 'High';
      else if (variabilityCoefficient > 25) demandVariability = 'Medium';

      // === 4. LEAD TIME ANALYSIS ===
      // Calculate average lead time from purchase orders (simplified)
      const purchaseMovements = productMovements
        .filter(m => m.quantity > 0 && m.movement_type === 'purchase')
        .sort((a, b) => new Date(b.created_date).getTime() - new Date(a.created_date).getTime());

      // Estimate lead time from historical order intervals, or use a default
      let avgLeadTime = product.lead_time || 7; // Default to 7 days, or use product's defined lead time
      if (purchaseMovements.length > 1) {
        const leadTimeIntervals = [];
        // Calculate intervals between received orders to estimate lead time
        for (let i = 0; i < purchaseMovements.length - 1; i++) {
          const days = differenceInDays(
            new Date(purchaseMovements[i].created_date), // Assuming created_date is close to order date
            new Date(purchaseMovements[i + 1].created_date)
          );
          if (days > 0 && days < 180) { // filter out unreasonable intervals
            leadTimeIntervals.push(days);
          }
        }
        if (leadTimeIntervals.length > 0) {
          avgLeadTime = leadTimeIntervals.reduce((sum, val) => sum + val, 0) / leadTimeIntervals.length;
        }
      }
      avgLeadTime = Math.max(1, Math.round(avgLeadTime)); // Ensure at least 1 day

      // === 5. SAFETY STOCK CALCULATION ===
      // Safety Stock = Z-score × Standard Deviation (of daily demand) × √Lead Time
      // Using Z-score of 1.65 for 95% service level
      const zScore = 1.65; // Approx 95% service level
      const safetyStock = (avgDailyConsumption > 0 && stdDev > 0) ? zScore * stdDev * Math.sqrt(avgLeadTime) : 0;

      // === 6. REORDER POINT CALCULATION ===
      // Reorder Point = (Avg Daily Consumption × Lead Time) + Safety Stock
      const reorderPoint = (avgDailyConsumption * avgLeadTime) + safetyStock;

      // === 7. ECONOMIC ORDER QUANTITY (EOQ) ===
      // EOQ = √((2 × Annual Demand × Order Cost) / Holding Cost per Unit)
      const annualDemand = avgDailyConsumption * 365;
      const orderCost = product.order_cost || 50; // Estimated ordering cost, or product specific
      const holdingCostRate = product.holding_cost_rate || 0.25; // 25% of unit cost per year
      const holdingCostPerUnit = (product.cost_price || 0) * holdingCostRate;

      const eoq = holdingCostPerUnit > 0 && annualDemand > 0
        ? Math.sqrt((2 * annualDemand * orderCost) / holdingCostPerUnit)
        : product.reorder_quantity || product.min_stock_level || 50; // Fallback to a reasonable default

      // === 8. FORECAST FUTURE STOCK LEVELS ===
      const forecastedConsumption = avgDailyConsumption * daysToForecast;
      const projectedStock = (product.current_stock || 0) - forecastedConsumption;

      // === 9. STOCKOUT RISK ASSESSMENT ===
      const daysUntilStockout = avgDailyConsumption > 0
        ? (product.current_stock || 0) / avgDailyConsumption
        : 999; // If no consumption, effectively never stock out

      let stockoutRisk = 'Low';
      if (daysUntilStockout <= avgLeadTime) stockoutRisk = 'Critical';
      else if (daysUntilStockout <= avgLeadTime * 1.5) stockoutRisk = 'High';
      else if (daysUntilStockout <= daysToForecast) stockoutRisk = 'Medium';
      else stockoutRisk = 'Low';

      // === 10. REORDER RECOMMENDATION ===
      const shouldReorder = (product.current_stock || 0) <= reorderPoint && avgDailyConsumption > 0;
      const recommendedOrderQty = shouldReorder ? Math.ceil(Math.max(eoq, (reorderPoint - (product.current_stock || 0)) + safetyStock)) : 0;
      const orderCostEstimate = recommendedOrderQty * (product.cost_price || 0);

      // === 11. OPTIMAL STOCK LEVEL ===
      // Optimal = Reorder Point + (EOQ / 2)
      const optimalStockLevel = reorderPoint + (eoq / 2);
      const currentVsOptimal = (product.current_stock || 0) - optimalStockLevel;

      let stockStatus = 'Optimal';
      if (currentVsOptimal < -optimalStockLevel * 0.2) stockStatus = 'Understocked';
      else if (currentVsOptimal > optimalStockLevel * 0.2) stockStatus = 'Overstocked';

      // === 12. FORECAST ACCURACY ===
      // Based on demand variability
      let forecastConfidence = 'High';
      if (variabilityCoefficient > 50) forecastConfidence = 'Low';
      else if (variabilityCoefficient > 25) forecastConfidence = 'Medium';

      return {
        product_id: product.id,
        product_name: product.product_name,
        sku: product.sku,
        category: product.category || 'Uncategorized',
        uom: product.uom,

        // Current State
        current_stock: product.current_stock || 0,
        unit_cost: product.cost_price || 0,

        // Consumption Metrics
        avg_daily_consumption: avgDailyConsumption,
        avg_daily_30: avgDaily30,
        avg_daily_60: avgDaily60,
        avg_daily_90: avgDaily90,

        // Trend & Variability
        trend: trend,
        trend_percentage: trendIndicator,
        demand_variability: demandVariability,
        variability_coefficient: variabilityCoefficient,

        // Lead Time & Safety
        avg_lead_time: avgLeadTime,
        safety_stock: safetyStock,

        // Reorder Calculations
        reorder_point: reorderPoint,
        economic_order_qty: eoq,
        optimal_stock_level: optimalStockLevel,

        // Forecasts
        forecasted_consumption: forecastedConsumption,
        projected_stock: projectedStock,
        days_until_stockout: daysUntilStockout,

        // Risk & Recommendations
        stockout_risk: stockoutRisk,
        should_reorder: shouldReorder,
        recommended_order_qty: recommendedOrderQty,
        order_cost_estimate: orderCostEstimate,
        stock_status: stockStatus,
        forecast_confidence: forecastConfidence,

        // Time periods
        forecast_days: daysToForecast
      };
    }).filter(p => p !== null) // Filter out products with insufficient consumption history
      .sort((a, b) => {
        // Sort by stockout risk priority
        const riskOrder = { Critical: 0, High: 1, Medium: 2, Low: 3 };
        return riskOrder[a.stockout_risk] - riskOrder[b.stockout_risk];
      });
  };

  // === EXPORT FUNCTIONS ===
  const exportToCSV = (data, filename, headers) => {
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(h => {
        const key = h.toLowerCase().replace(/\s+/g, '_').replace(/[()/%]/g, '');
        let value = row[key] !== undefined ? row[key] : '';

        // Format numbers for better readability in CSV
        if (typeof value === 'number') {
            if (key.includes('cost') || key.includes('value') || key.includes('profit') || key.includes('revenue')) {
                value = formatCurrency(value, currency);
            } else {
                value = value.toFixed(2);
            }
        }
        // Handle booleans
        if (typeof value === 'boolean') {
          value = value ? 'Yes' : 'No';
        }
        return `"${String(value).replace(/"/g, '""')}"`; // Escape quotes and wrap in quotes
      }).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${format(new Date(), 'yyyy-MM-dd_HHmmss')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportInventoryValuationCSV = () => {
    const data = generateInventoryValuation();
    exportToCSV(data, 'inventory_valuation', [
      'product_name', 'sku', 'category', 'costing_method', 'uom',
      'current_stock', 'unit_cost', 'current_value', 'total_purchased',
      'total_sold', 'total_cogs', 'avg_cogs', 'turnover_ratio',
      'retail_price', 'potential_revenue', 'potential_profit', 'profit_margin'
    ]);
  };

  const exportStockMovementCSV = () => {
    const data = generateStockMovementHistory();
    exportToCSV(data, 'stock_movement_history', [
      'movement_date_formatted', 'movement_number', 'movement_type', 'product_name',
      'sku', 'category', 'direction', 'abs_quantity', 'uom', 'unit_cost',
      'total_cost', 'calculated_cogs', 'costing_method', 'supplier_name',
      'reference_number', 'notes'
    ]);
  };

  const exportLowStockCSV = () => {
    const data = generateLowStockReport();
    exportToCSV(data, 'low_stock_alert', [
      'priority', 'product_name', 'sku', 'category', 'current_stock',
      'min_stock_level', 'stock_percentage', 'shortage', 'reorder_quantity',
      'reorder_cost', 'unit_cost', 'days_since_last_purchase',
      'avg_daily_consumption', 'days_until_stockout', 'costing_method'
    ]);
  };

  const exportTurnoverCSV = () => {
    const data = generateInventoryTurnover();
    exportToCSV(data, 'inventory_turnover', [
      'product_name', 'sku', 'category', 'stock_health', 'beginning_stock',
      'quantity_purchased', 'quantity_sold', 'ending_stock', 'avg_inventory',
      'avg_inventory_value', 'period_cogs', 'turnover_ratio', 'days_sales_in_inventory',
      'sales_velocity', 'potential_revenue', 'actual_profit', 'profit_margin'
    ]);
  };

  const exportForecastCSV = () => {
    const data = generateInventoryForecast();
    exportToCSV(data, 'inventory_forecast', [
      'product_name', 'sku', 'category', 'current_stock', 'avg_daily_consumption',
      'trend', 'trend_percentage', 'demand_variability', 'variability_coefficient', 'avg_lead_time',
      'safety_stock', 'reorder_point', 'economic_order_qty', 'optimal_stock_level', 'forecasted_consumption',
      'projected_stock', 'days_until_stockout', 'stockout_risk', 'should_reorder',
      'recommended_order_qty', 'order_cost_estimate', 'stock_status', 'forecast_confidence', 'forecast_days'
    ]);
  };

  const printReport = () => {
    window.print();
  };

  // Get unique categories
  const categories = [...new Set(products.map(p => p.category).filter(Boolean))];

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

  // Generate data for reports
  const valuationData = generateInventoryValuation();
  const movementData = generateStockMovementHistory();
  const lowStockData = generateLowStockReport();
  const turnoverData = generateInventoryTurnover();
  const forecastData = generateInventoryForecast(); // Generate forecast data

  // Calculate summary statistics
  const totalInventoryValue = valuationData.reduce((sum, p) => sum + p.current_value, 0);
  const totalPotentialRevenue = valuationData.reduce((sum, p) => sum + p.potential_revenue, 0);
  const totalPotentialProfit = valuationData.reduce((sum, p) => sum + p.potential_profit, 0);

  const criticalLowStock = lowStockData.filter(p => p.is_critical).length;
  const totalReorderCost = lowStockData.reduce((sum, p) => sum + p.reorder_cost, 0);

  const avgTurnoverRatio = turnoverData.length > 0
    ? turnoverData.reduce((sum, p) => sum + p.turnover_ratio, 0) / turnoverData.length
    : 0;

  const fastMovingItems = turnoverData.filter(p => p.stock_health === 'Fast-Moving').length;
  const slowMovingItems = turnoverData.filter(p => p.stock_health === 'Slow-Moving').length;

  // Forecast statistics
  const criticalStockoutRisk = forecastData.filter(p => p.stockout_risk === 'Critical').length;
  const itemsNeedingReorder = forecastData.filter(p => p.should_reorder).length;
  const totalReorderInvestment = forecastData.reduce((sum, p) => sum + (p.should_reorder ? p.order_cost_estimate : 0), 0);
  const understockedItems = forecastData.filter(p => p.stock_status === 'Understocked').length;
  const overstockedItems = forecastData.filter(p => p.stock_status === 'Overstocked').length;

  // Priority colors for low stock
  const priorityColors = {
    CRITICAL: 'bg-red-100 text-red-800 border-red-300',
    HIGH: 'bg-orange-100 text-orange-800 border-orange-300',
    MEDIUM: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    LOW: 'bg-blue-100 text-blue-800 border-blue-300'
  };

  // Risk colors for forecast
  const riskColors = {
    Critical: 'bg-red-100 text-red-800 border-red-300',
    High: 'bg-orange-100 text-orange-800 border-orange-300',
    Medium: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    Low: 'bg-green-100 text-green-800 border-green-300'
  };

  // Stock status colors for forecast
  const statusColors = {
    Understocked: 'bg-red-100 text-red-700',
    Optimal: 'bg-green-100 text-green-700',
    Overstocked: 'bg-orange-100 text-orange-700'
  };

  return (
    <div className="p-6 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
              <BarChart3 className="w-8 h-8 text-blue-600" />
              Advanced Inventory Reports
            </h1>
            <p className="text-slate-500 mt-1">Comprehensive inventory analysis with AI-powered forecasting</p>
          </div>
          <Button onClick={printReport} variant="outline">
            <Printer className="w-4 h-4 mr-2" />
            Print Reports
          </Button>
        </div>

        {/* Global Filters */}
        <Card className="border-none shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-blue-600" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-4 gap-4">
              <div>
                <Label>From Date</Label>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div>
                <Label>To Date</Label>
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
              <div>
                <Label>Category</Label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {categories.map(cat => (
                      <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Search</Label>
                <Input
                  placeholder="Product name or SKU..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white border-none shadow-lg">
            <CardContent className="pt-6">
              <DollarSign className="w-8 h-8 mb-2" />
              <p className="text-3xl font-bold">{formatCurrency(totalInventoryValue, currency)}</p>
              <p className="text-sm opacity-90">Total Inventory Value</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-red-500 to-red-600 text-white border-none shadow-lg">
            <CardContent className="pt-6">
              <AlertTriangle className="w-8 h-8 mb-2" />
              <p className="text-3xl font-bold">{criticalStockoutRisk}</p>
              <p className="text-sm opacity-90">Critical Stockout Risk</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white border-none shadow-lg">
            <CardContent className="pt-6">
              <Target className="w-8 h-8 mb-2" />
              <p className="text-3xl font-bold">{itemsNeedingReorder}</p>
              <p className="text-sm opacity-90">Items Need Reorder</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-500 to-purple-600 text-white border-none shadow-lg">
            <CardContent className="pt-6">
              <Activity className="w-8 h-8 mb-2" />
              <p className="text-3xl font-bold">{avgTurnoverRatio.toFixed(2)}x</p>
              <p className="text-sm opacity-90">Avg Turnover Ratio</p>
            </CardContent>
          </Card>
        </div>

        {/* Report Tabs */}
        <Tabs defaultValue="forecast"> {/* Changed default value to forecast */}
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="forecast">Inventory Forecast</TabsTrigger> {/* New Tab */}
            <TabsTrigger value="valuation">Valuation</TabsTrigger>
            <TabsTrigger value="movements">Movements</TabsTrigger>
            <TabsTrigger value="low-stock">Low Stock</TabsTrigger>
            <TabsTrigger value="turnover">Turnover</TabsTrigger>
          </TabsList>

          {/* REPORT 1: INVENTORY VALUATION */}
          <TabsContent value="valuation" className="space-y-6 mt-6">
            <div className="grid md:grid-cols-2 gap-4 mb-4">
              <div>
                <Label>Costing Method Filter</Label>
                <Select value={selectedCostingMethod} onValueChange={setSelectedCostingMethod}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Methods</SelectItem>
                    <SelectItem value="fifo">FIFO</SelectItem>
                    <SelectItem value="weighted_average">Weighted Average</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Card className="border-none shadow-lg">
              <CardHeader className="flex flex-row justify-between items-center">
                <CardTitle>Inventory Valuation Report</CardTitle>
                <Button size="sm" onClick={exportInventoryValuationCSV}>
                  <FileDown className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent>
                <div className="mb-6 grid md:grid-cols-3 gap-4 p-4 bg-slate-50 rounded-lg">
                  <div>
                    <p className="text-sm text-slate-600">Total Products</p>
                    <p className="text-2xl font-bold text-slate-900">{valuationData.length}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Total Value</p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(totalInventoryValue, currency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Potential Profit</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {formatCurrency(totalPotentialProfit, currency)}
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b-2">
                      <tr className="text-left">
                        <th className="py-3 px-4 font-semibold">Product</th>
                        <th className="py-3 px-4 font-semibold">Method</th>
                        <th className="py-3 px-4 font-semibold text-right">Stock</th>
                        <th className="py-3 px-4 font-semibold text-right">Unit Cost</th>
                        <th className="py-3 px-4 font-semibold text-right">Total Value</th>
                        <th className="py-3 px-4 font-semibold text-right">Sold</th>
                        <th className="py-3 px-4 font-semibold text-right">COGS</th>
                        <th className="py-3 px-4 font-semibold text-right">Margin %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {valuationData.map((item, i) => (
                        <tr key={i} className="border-b hover:bg-slate-50">
                          <td className="py-3 px-4">
                            <div>
                              <p className="font-medium">{item.product_name}</p>
                              <p className="text-xs text-slate-500">{item.sku} • {item.category}</p>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant="outline" className={item.costing_method === 'fifo' ? 'bg-blue-50' : 'bg-green-50'}>
                              {item.costing_method === 'fifo' ? 'FIFO' : 'Weighted Avg'}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-right font-medium">
                            {item.current_stock} {item.uom}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {formatCurrency(item.unit_cost, currency)}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-green-600">
                            {formatCurrency(item.current_value, currency)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {item.total_sold.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right text-red-600">
                            {formatCurrency(item.total_cogs, currency)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className={item.profit_margin > 30 ? 'text-green-600 font-bold' : item.profit_margin > 15 ? 'text-blue-600' : 'text-orange-600'}>
                              {item.profit_margin.toFixed(1)}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 bg-slate-50">
                      <tr className="font-bold">
                        <td className="py-3 px-4" colSpan="4">TOTALS:</td>
                        <td className="py-3 px-4 text-right text-green-600">
                          {formatCurrency(totalInventoryValue, currency)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {valuationData.reduce((sum, p) => sum + p.total_sold, 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right text-red-600">
                          {formatCurrency(valuationData.reduce((sum, p) => sum + p.total_cogs, 0), currency)}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Valuation by Category Chart */}
                <div className="mt-8">
                  <h3 className="font-semibold mb-4">Valuation by Category</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie
                        data={Object.entries(
                          valuationData.reduce((acc, item) => {
                            acc[item.category] = (acc[item.category] || 0) + item.current_value;
                            return acc;
                          }, {})
                        ).map(([name, value]) => ({ name, value }))}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        outerRadius={100}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {Object.keys(valuationData.reduce((acc, item) => {
                          acc[item.category] = true;
                          return acc;
                        }, {})).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(value, currency)} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* REPORT 2: STOCK MOVEMENT HISTORY */}
          <TabsContent value="movements" className="space-y-6 mt-6">
            <div className="grid md:grid-cols-2 gap-4 mb-4">
              <div>
                <Label>Movement Type</Label>
                <Select value={selectedMovementType} onValueChange={setSelectedMovementType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="purchase">Purchase</SelectItem>
                    <SelectItem value="sale">Sale</SelectItem>
                    <SelectItem value="consumption">Consumption</SelectItem>
                    <SelectItem value="transfer">Transfer</SelectItem>
                    <SelectItem value="adjustment">Adjustment</SelectItem>
                    <SelectItem value="return">Return</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Card className="border-none shadow-lg">
              <CardHeader className="flex flex-row justify-between items-center">
                <CardTitle>Stock Movement History Report</CardTitle>
                <Button size="sm" onClick={exportStockMovementCSV}>
                  <FileDown className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent>
                <div className="mb-6 grid md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-lg">
                  <div>
                    <p className="text-sm text-slate-600">Total Movements</p>
                    <p className="text-2xl font-bold text-slate-900">{movementData.length}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Total Inbound</p>
                    <p className="text-2xl font-bold text-green-600">
                      {movementData.filter(m => m.quantity > 0).reduce((sum, m) => sum + m.quantity, 0).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Total Outbound</p>
                    <p className="text-2xl font-bold text-red-600">
                      {Math.abs(movementData.filter(m => m.quantity < 0).reduce((sum, m) => sum + m.quantity, 0)).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Total COGS</p>
                    <p className="text-2xl font-bold text-orange-600">
                      {formatCurrency(movementData.reduce((sum, m) => sum + (m.calculated_cogs || 0), 0), currency)}
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b-2">
                      <tr className="text-left">
                        <th className="py-3 px-4 font-semibold">Date</th>
                        <th className="py-3 px-4 font-semibold">Type</th>
                        <th className="py-3 px-4 font-semibold">Product</th>
                        <th className="py-3 px-4 font-semibold">Method</th>
                        <th className="py-3 px-4 font-semibold text-right">Direction</th>
                        <th className="py-3 px-4 font-semibold text-right">Quantity</th>
                        <th className="py-3 px-4 font-semibold text-right">Unit Cost</th>
                        <th className="py-3 px-4 font-semibold text-right">COGS</th>
                        <th className="py-3 px-4 font-semibold text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movementData.map((movement, i) => (
                        <tr key={i} className="border-b hover:bg-slate-50">
                          <td className="py-3 px-4">
                            <p className="font-medium">{movement.movement_date_formatted}</p>
                            <p className="text-xs text-slate-500">{movement.movement_number}</p>
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant="outline" className="capitalize">
                              {movement.movement_type.replace('_', ' ')}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <p className="font-medium">{movement.product_name}</p>
                            <p className="text-xs text-slate-500">{movement.sku} • {movement.category}</p>
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant="outline" className="text-xs">
                              {movement.costing_method === 'fifo' ? 'FIFO' :
                               movement.costing_method === 'weighted_average' ? 'W.Avg' : 'N/A'}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Badge className={movement.direction === 'IN' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}>
                              {movement.direction}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-right font-medium">
                            {movement.abs_quantity} {movement.uom}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {formatCurrency(movement.unit_cost || 0, currency)}
                          </td>
                          <td className="py-3 px-4 text-right text-orange-600">
                            {movement.calculated_cogs > 0 ? formatCurrency(movement.calculated_cogs, currency) : '-'}
                          </td>
                          <td className="py-3 px-4 text-right font-bold">
                            {formatCurrency(movement.total_cost || 0, currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {movementData.length === 0 && (
                  <div className="text-center py-12 text-slate-400">
                    <Package className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                    <p>No movements found for selected filters</p>
                  </div>
                )}

                {/* Movement Trend Chart */}
                {movementData.length > 0 && (
                  <div className="mt-8">
                    <h3 className="font-semibold mb-4">Movement Trend (by Type)</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={Object.entries(
                        movementData.reduce((acc, m) => {
                          acc[m.movement_type] = (acc[m.movement_type] || 0) + 1;
                          return acc;
                        }, {})
                      ).map(([name, count]) => ({ name: name.replace('_', ' '), count }))}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="count" fill="#3b82f6" name="Number of Movements" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* REPORT 3: LOW STOCK ALERT */}
          <TabsContent value="low-stock" className="space-y-6 mt-6">
            <Card className="border-none shadow-lg">
              <CardHeader className="flex flex-row justify-between items-center">
                <CardTitle>Low Stock Alert Report</CardTitle>
                <Button size="sm" onClick={exportLowStockCSV}>
                  <FileDown className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent>
                <div className="mb-6 grid md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-lg">
                  <div>
                    <p className="text-sm text-slate-600">Critical Items</p>
                    <p className="text-2xl font-bold text-red-600">{criticalLowStock}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Total Low Stock</p>
                    <p className="text-2xl font-bold text-orange-600">{lowStockData.length}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Total Reorder Cost</p>
                    <p className="text-2xl font-bold text-green-600">
                      {formatCurrency(totalReorderCost, currency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Total Shortage</p>
                    <p className="text-2xl font-bold text-slate-900">
                      {lowStockData.reduce((sum, p) => sum + p.shortage, 0).toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b-2">
                      <tr className="text-left">
                        <th className="py-3 px-4 font-semibold">Priority</th>
                        <th className="py-3 px-4 font-semibold">Product</th>
                        <th className="py-3 px-4 font-semibold text-right">Current</th>
                        <th className="py-3 px-4 font-semibold text-right">Min Level</th>
                        <th className="py-3 px-4 font-semibold text-right">Shortage</th>
                        <th className="py-3 px-4 font-semibold text-right">Reorder Qty</th>
                        <th className="py-3 px-4 font-semibold text-right">Cost</th>
                        <th className="py-3 px-4 font-semibold text-right">Days to Stockout</th>
                      </tr>
                    </thead>
                    <tbody>
                      {lowStockData.map((item, i) => (
                        <tr key={i} className="border-b hover:bg-slate-50">
                          <td className="py-3 px-4">
                            <Badge className={priorityColors[item.priority]}>
                              {item.priority}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <div>
                              <p className="font-medium">{item.product_name}</p>
                              <p className="text-xs text-slate-500">{item.sku} • {item.category}</p>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className={item.is_critical ? 'text-red-600 font-bold' : 'font-medium'}>
                              {item.current_stock} {item.uom}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            {item.min_stock_level} {item.uom}
                          </td>
                          <td className="py-3 px-4 text-right text-red-600 font-medium">
                            {item.shortage.toFixed(2)} {item.uom}
                          </td>
                          <td className="py-3 px-4 text-right font-bold">
                            {item.reorder_quantity} {item.uom}
                          </td>
                          <td className="py-3 px-4 text-right text-green-600 font-bold">
                            {formatCurrency(item.reorder_cost, currency)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {item.days_until_stockout !== null ? (
                              <span className={item.days_until_stockout < 7 ? 'text-red-600 font-bold' : 'text-slate-700'}>
                                {item.days_until_stockout} days
                              </span>
                            ) : (
                              <span className="text-slate-400">N/A</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 bg-slate-50">
                      <tr className="font-bold">
                        <td className="py-3 px-4" colSpan="4">TOTALS:</td>
                        <td className="py-3 px-4 text-right text-red-600">
                          {lowStockData.reduce((sum, p) => sum + p.shortage, 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {lowStockData.reduce((sum, p) => sum + p.reorder_quantity, 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right text-green-600">
                          {formatCurrency(totalReorderCost, currency)}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {lowStockData.length === 0 && (
                  <div className="text-center py-12 text-slate-400">
                    <Package className="w-16 h-16 mx-auto mb-4 text-green-300" />
                    <p className="text-green-600 font-medium">All products are adequately stocked!</p>
                  </div>
                )}

                {/* Priority Distribution Chart */}
                {lowStockData.length > 0 && (
                  <div className="mt-8">
                    <h3 className="font-semibold mb-4">Alert Priority Distribution</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={Object.entries(
                            lowStockData.reduce((acc, item) => {
                              acc[item.priority] = (acc[item.priority] || 0) + 1;
                              return acc;
                            }, {})
                          ).map(([name, value]) => ({ name, value }))}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, value }) => `${name}: ${value}`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          {Object.keys(lowStockData.reduce((acc, item) => {
                            acc[item.priority] = true;
                            return acc;
                          }, {})).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={
                              entry === 'CRITICAL' ? '#ef4444' :
                              entry === 'HIGH' ? '#f97316' :
                              entry === 'MEDIUM' ? '#eab308' :
                              '#3b82f6'
                            } />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* REPORT 4: INVENTORY TURNOVER (ENHANCED) */}
          <TabsContent value="turnover" className="space-y-6 mt-6">
            <Card className="border-none shadow-lg">
              <CardHeader className="flex flex-row justify-between items-center">
                <CardTitle>Enhanced Inventory Turnover Report</CardTitle>
                <Button size="sm" onClick={exportTurnoverCSV}>
                  <FileDown className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent>
                <div className="mb-6 grid md:grid-cols-4 gap-4 p-4 bg-slate-50 rounded-lg">
                  <div>
                    <p className="text-sm text-slate-600">Avg Turnover Ratio</p>
                    <p className="text-2xl font-bold text-blue-600">{avgTurnoverRatio.toFixed(2)}x</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Fast-Moving Items</p>
                    <p className="text-2xl font-bold text-green-600">{fastMovingItems}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Slow-Moving Items</p>
                    <p className="text-2xl font-bold text-red-600">{slowMovingItems}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-600">Period</p>
                    <p className="text-lg font-bold text-slate-900">
                      {differenceInDays(new Date(dateTo), new Date(dateFrom))} days
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b-2">
                      <tr className="text-left">
                        <th className="py-3 px-4 font-semibold">Product</th>
                        <th className="py-3 px-4 font-semibold">Health</th>
                        <th className="py-3 px-4 font-semibold text-right">Avg Inventory</th>
                        <th className="py-3 px-4 font-semibold text-right">Avg Value</th>
                        <th className="py-3 px-4 font-semibold text-right">Sold</th>
                        <th className="py-3 px-4 font-semibold text-right">COGS</th>
                        <th className="py-3 px-4 font-semibold text-right">Turnover</th>
                        <th className="py-3 px-4 font-semibold text-right">Days in Inv</th>
                        <th className="py-3 px-4 font-semibold text-right">Profit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {turnoverData.map((item, i) => (
                        <tr key={i} className="border-b hover:bg-slate-50">
                          <td className="py-3 px-4">
                            <div>
                              <p className="font-medium">{item.product_name}</p>
                              <p className="text-xs text-slate-500">{item.sku} • {item.category}</p>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <Badge className={
                              item.stock_health === 'Fast-Moving' ? 'bg-green-100 text-green-700' :
                              item.stock_health === 'Slow-Moving' ? 'bg-red-100 text-red-700' :
                              'bg-blue-100 text-blue-700'
                            }>
                              {item.stock_health}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-right">
                            {item.avg_inventory.toFixed(2)} {item.uom}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {formatCurrency(item.avg_inventory_value, currency)}
                          </td>
                          <td className="py-3 px-4 text-right font-medium">
                            {item.quantity_sold.toFixed(2)}
                          </td>
                          <td className="py-3 px-4 text-right text-red-600">
                            {formatCurrency(item.period_cogs, currency)}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className={
                              item.turnover_ratio > 6 ? 'text-green-600 font-bold' :
                              item.turnover_ratio > 3 ? 'text-blue-600 font-medium' :
                              'text-orange-600'
                            }>
                              {item.turnover_ratio.toFixed(2)}x
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            {item.days_sales_in_inventory < 999 ? Math.round(item.days_sales_in_inventory) : '-'}
                          </td>
                          <td className="py-3 px-4 text-right font-bold text-green-600">
                            {formatCurrency(item.actual_profit, currency)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 bg-slate-50">
                      <tr className="font-bold">
                        <td className="py-3 px-4" colSpan="3">TOTALS/AVERAGES:</td>
                        <td className="py-3 px-4 text-right">
                          {formatCurrency(turnoverData.reduce((sum, p) => sum + p.avg_inventory_value, 0), currency)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          {turnoverData.reduce((sum, p) => sum + p.quantity_sold, 0).toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right text-red-600">
                          {formatCurrency(turnoverData.reduce((sum, p) => sum + p.period_cogs, 0), currency)}
                        </td>
                        <td className="py-3 px-4 text-right text-blue-600">
                          {avgTurnoverRatio.toFixed(2)}x
                        </td>
                        <td></td>
                        <td className="py-3 px-4 text-right text-green-600">
                          {formatCurrency(turnoverData.reduce((sum, p) => sum + p.actual_profit, 0), currency)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {turnoverData.length === 0 && (
                  <div className="text-center py-12 text-slate-400">
                    <TrendingUp className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                    <p>No turnover data available for selected period</p>
                  </div>
                )}

                {/* Turnover Performance Chart */}
                {turnoverData.length > 0 && (
                  <div className="mt-8">
                    <h3 className="font-semibold mb-4">Top 10 Products by Turnover Ratio</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={turnoverData.slice(0, 10)} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis dataKey="product_name" type="category" width={150} />
                        <Tooltip />
                        <Bar dataKey="turnover_ratio" fill="#3b82f6" name="Turnover Ratio" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Stock Health Distribution */}
                {turnoverData.length > 0 && (
                  <div className="mt-8">
                    <h3 className="font-semibold mb-4">Stock Health Distribution</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={Object.entries(
                            turnoverData.reduce((acc, item) => {
                              acc[item.stock_health] = (acc[item.stock_health] || 0) + 1;
                              return acc;
                            }, {})
                          ).map(([name, value]) => ({ name, value }))}
                          cx="50%"
                          cy="50%"
                          labelLine={false}
                          label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                          outerRadius={100}
                          fill="#8884d8"
                          dataKey="value"
                        >
                          <Cell fill="#10b981" />
                          <Cell fill="#3b82f6" />
                          <Cell fill="#ef4444" />
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* REPORT 5: INVENTORY FORECAST (NEW!) */}
          <TabsContent value="forecast" className="space-y-6 mt-6">
            <div className="grid md:grid-cols-2 gap-4 mb-4">
              <div>
                <Label>Forecast Period</Label>
                <Select value={forecastDays} onValueChange={setForecastDays}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7 Days</SelectItem>
                    <SelectItem value="14">14 Days</SelectItem>
                    <SelectItem value="30">30 Days</SelectItem>
                    <SelectItem value="60">60 Days</SelectItem>
                    <SelectItem value="90">90 Days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Forecast Summary Cards */}
            <div className="grid md:grid-cols-4 gap-4">
              <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
                <CardContent className="pt-6">
                  <AlertTriangle className="w-6 h-6 text-red-600 mb-2" />
                  <p className="text-2xl font-bold text-red-700">{criticalStockoutRisk}</p>
                  <p className="text-sm text-red-600">Critical Risk Items</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
                <CardContent className="pt-6">
                  <Target className="w-6 h-6 text-orange-600 mb-2" />
                  <p className="text-2xl font-bold text-orange-700">{itemsNeedingReorder}</p>
                  <p className="text-sm text-orange-600">Reorder Recommended</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                <CardContent className="pt-6">
                  <DollarSign className="w-6 h-6 text-blue-600 mb-2" />
                  <p className="text-2xl font-bold text-blue-700">
                    {formatCurrency(totalReorderInvestment, currency)}
                  </p>
                  <p className="text-sm text-blue-600">Total Reorder Cost</p>
                </CardContent>
              </Card>

              <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                <CardContent className="pt-6">
                  <Activity className="w-6 h-6 text-purple-600 mb-2" />
                  <p className="text-2xl font-bold text-purple-700">{understockedItems}/{overstockedItems}</p>
                  <p className="text-sm text-purple-600">Under / Over Stocked</p>
                </CardContent>
              </Card>
            </div>

            <Card className="border-none shadow-lg">
              <CardHeader className="flex flex-row justify-between items-center">
                <CardTitle className="flex items-center gap-2">
                  <Zap className="w-5 h-5 text-yellow-600" />
                  AI-Powered Inventory Forecast & Recommendations
                </CardTitle>
                <Button size="sm" onClick={exportForecastCSV}>
                  <FileDown className="w-4 h-4 mr-2" />
                  Export CSV
                </Button>
              </CardHeader>
              <CardContent>
                <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm text-blue-900">
                    <strong>Forecast Methodology:</strong> Using weighted average consumption (50% last 30 days, 30% last 60 days, 20% last 90 days),
                    trend analysis, demand variability assessment, and Economic Order Quantity (EOQ) calculations to provide optimal reorder recommendations.
                    Forecast confidence is based on demand variability. Lead time is estimated from historical purchase intervals or product setting.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b-2">
                      <tr className="text-left">
                        <th className="py-3 px-4 font-semibold">Product</th>
                        <th className="py-3 px-4 font-semibold text-right">Current</th>
                        <th className="py-3 px-4 font-semibold text-right">Daily Use</th>
                        <th className="py-3 px-4 font-semibold text-right">Forecast ({forecastDays}d)</th>
                        <th className="py-3 px-4 font-semibold text-right">Days Left</th>
                        <th className="py-3 px-4 font-semibold">Risk</th>
                        <th className="py-3 px-4 font-semibold">Status</th>
                        <th className="py-3 px-4 font-semibold text-right">Reorder Point</th>
                        <th className="py-3 px-4 font-semibold text-right">Order Qty</th>
                        <th className="py-3 px-4 font-semibold text-right">Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {forecastData.map((item, i) => (
                        <tr key={i} className="border-b hover:bg-slate-50">
                          <td className="py-3 px-4">
                            <div>
                              <p className="font-medium">{item.product_name}</p>
                              <div className="flex flex-wrap gap-2 mt-1">
                                <p className="text-xs text-slate-500">{item.sku}</p>
                                <Badge variant="outline" className="text-xs">
                                  {item.trend} {item.trend_percentage.toFixed(0)}%
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  {item.demand_variability} Var ({item.variability_coefficient.toFixed(0)}%)
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  Lead: {item.avg_lead_time.toFixed(0)}d
                                </Badge>
                                <Badge variant="outline" className="text-xs">
                                  Confidence: {item.forecast_confidence}
                                </Badge>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className={item.current_stock <= item.reorder_point ? 'text-red-600 font-bold' : 'font-medium'}>
                              {item.current_stock.toFixed(1)} {item.uom}
                            </span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className="text-slate-700">{item.avg_daily_consumption.toFixed(2)}</span>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div>
                              <p className="font-medium text-orange-600">
                                -{item.forecasted_consumption.toFixed(1)}
                              </p>
                              <p className="text-xs text-slate-500">
                                → {item.projected_stock.toFixed(1)} {item.uom}
                              </p>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <span className={
                              item.days_until_stockout <= item.avg_lead_time ? 'text-red-600 font-bold' :
                              item.days_until_stockout <= (item.avg_lead_time * 1.5) ? 'text-orange-600 font-medium' :
                              'text-slate-700'
                            }>
                              {item.days_until_stockout < 999 ? Math.floor(item.days_until_stockout) : '999+'}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <Badge className={riskColors[item.stockout_risk]}>
                              {item.stockout_risk}
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <Badge className={statusColors[item.stock_status]}>
                              {item.stock_status}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div>
                              <p className="font-medium text-blue-600">
                                {item.reorder_point.toFixed(1)}
                              </p>
                              <p className="text-xs text-slate-500">
                                Safety: {item.safety_stock.toFixed(1)}
                              </p>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            {item.should_reorder ? (
                              <span className="font-bold text-green-600">
                                {item.recommended_order_qty.toFixed(0)} {item.uom}
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            {item.should_reorder ? (
                              <span className="font-bold text-green-600">
                                {formatCurrency(item.order_cost_estimate, currency)}
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 bg-slate-50">
                      <tr className="font-bold">
                        <td className="py-3 px-4" colSpan="9">TOTAL REORDER INVESTMENT:</td>
                        <td className="py-3 px-4 text-right text-green-600">
                          {formatCurrency(totalReorderInvestment, currency)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {forecastData.length === 0 && (
                  <div className="text-center py-12 text-slate-400">
                    <Activity className="w-16 h-16 mx-auto mb-4 text-slate-300" />
                    <p>No forecast data available. Products need consumption history to generate forecasts.</p>
                  </div>
                )}

                {/* Forecast Visualization Charts */}
                {forecastData.length > 0 && (
                  <>
                    {/* Stockout Risk Distribution */}
                    <div className="mt-8">
                      <h3 className="font-semibold mb-4">Stockout Risk Distribution</h3>
                      <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                          <Pie
                            data={Object.entries(
                              forecastData.reduce((acc, item) => {
                                acc[item.stockout_risk] = (acc[item.stockout_risk] || 0) + 1;
                                return acc;
                              }, {})
                            ).map(([name, value]) => ({ name, value }))}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, value, percent }) => `${name}: ${value} (${(percent * 100).toFixed(0)}%)`}
                            outerRadius={100}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            <Cell fill="#ef4444" /> {/* Critical */}
                            <Cell fill="#f97316" /> {/* High */}
                            <Cell fill="#eab308" /> {/* Medium */}
                            <Cell fill="#10b981" /> {/* Low */}
                          </Pie>
                          <Tooltip />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Top 10 Items by Reorder Priority */}
                    <div className="mt-8">
                      <h3 className="font-semibold mb-4">Top 10 Items by Reorder Investment</h3>
                      <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={forecastData.filter(p => p.should_reorder).sort((a, b) => b.order_cost_estimate - a.order_cost_estimate).slice(0, 10)} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis type="number" />
                          <YAxis dataKey="product_name" type="category" width={150} />
                          <Tooltip formatter={(value) => formatCurrency(value, currency)} />
                          <Bar dataKey="order_cost_estimate" fill="#10b981" name="Reorder Cost" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Demand Trend Analysis */}
                    <div className="mt-8">
                      <h3 className="font-semibold mb-4">Demand Trend Distribution</h3>
                      <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={Object.entries(
                          forecastData.reduce((acc, item) => {
                            acc[item.trend] = (acc[item.trend] || 0) + 1;
                            return acc;
                          }, {})
                        ).map(([name, count]) => ({ name, count }))}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" />
                          <YAxis />
                          <Tooltip />
                          <Bar dataKey="count" fill="#3b82f6" name="Number of Products" />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
