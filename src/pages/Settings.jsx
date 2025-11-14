import React, { useState, useEffect } from "react";
import { get, post } from "@/api/http";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Settings as SettingsIcon, Save, Check } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [showSuccess, setShowSuccess] = useState(false);

  // Fetch settings
  const { data: settingsList = [], isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: () => base44.entities.Setting.list(),
  });

  // Local state for form values
  const [company_name, setCompanyName] = useState('E-COMWash');
  const [default_currency, setDefaultCurrency] = useState('USD');
  const [default_tax_rate, setDefaultTaxRate] = useState(0);
  const [fiscal_year_start, setFiscalYearStart] = useState('01-01');
  const [tax_enabled, setTaxEnabled] = useState(false);
  const [loyalty_enabled, setLoyaltyEnabled] = useState(true);
  const [auto_invoice, setAutoInvoice] = useState(false);
  const [low_stock_threshold, setLowStockThreshold] = useState(10);

  // Load settings into state
  useEffect(() => {
    const settingsMap = {};
    settingsList.forEach((setting) => {
      try {
        settingsMap[setting.key] = JSON.parse(setting.value);
      } catch {
        settingsMap[setting.key] = setting.value;
      }
    });

    if (settingsMap.company_name) setCompanyName(settingsMap.company_name);
    if (settingsMap.default_currency) setDefaultCurrency(settingsMap.default_currency);
    if (settingsMap.default_tax_rate !== undefined) setDefaultTaxRate(settingsMap.default_tax_rate);
    if (settingsMap.fiscal_year_start) setFiscalYearStart(settingsMap.fiscal_year_start);
    if (settingsMap.tax_enabled !== undefined) setTaxEnabled(settingsMap.tax_enabled);
    if (settingsMap.loyalty_enabled !== undefined) setLoyaltyEnabled(settingsMap.loyalty_enabled);
    if (settingsMap.auto_invoice !== undefined) setAutoInvoice(settingsMap.auto_invoice);
    if (settingsMap.low_stock_threshold !== undefined) setLowStockThreshold(settingsMap.low_stock_threshold);
  }, [settingsList]);

  // Save settings mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async (settings) => {
      // Update or create each setting
      const promises = Object.entries(settings).map(([key, value]) => {
        const existingSetting = settingsList.find(s => s.key === key);
        const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
        
        if (existingSetting) {
          return base44.entities.Setting.update(existingSetting.id, { 
            key, 
            value: valueStr,
            category: getCategoryForKey(key)
          });
        } else {
          return base44.entities.Setting.create({ 
            key, 
            value: valueStr,
            category: getCategoryForKey(key)
          });
        }
      });
      
      await Promise.all(promises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['settings']);
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    },
  });

  const getCategoryForKey = (key) => {
    if (['company_name'].includes(key)) return 'company';
    if (['default_currency', 'default_tax_rate', 'fiscal_year_start', 'tax_enabled', 'auto_invoice'].includes(key)) return 'financial';
    if (['loyalty_enabled', 'low_stock_threshold'].includes(key)) return 'operations';
    return 'company';
  };

  const handleSave = () => {
    saveSettingsMutation.mutate({
      company_name,
      default_currency,
      default_tax_rate,
      fiscal_year_start,
      tax_enabled,
      loyalty_enabled,
      auto_invoice,
      low_stock_threshold
    });
  };

  if (isLoading) {
    return <div className="p-8 text-center">Loading settings...</div>;
  }

  return (
    <div className="p-6 md:p-8 min-h-screen">
      <div className="max-w-4xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-3">
            <SettingsIcon className="w-8 h-8 text-blue-600" />
            System Settings
          </h1>
          <p className="text-slate-500 mt-1">Configure system-wide settings and preferences</p>
        </div>

        <Tabs defaultValue="company">
          <TabsList>
            <TabsTrigger value="company">Company</TabsTrigger>
            <TabsTrigger value="financial">Financial</TabsTrigger>
            <TabsTrigger value="operations">Operations</TabsTrigger>
          </TabsList>

          <TabsContent value="company" className="mt-6">
            <Card className="border-none shadow-lg">
              <CardHeader>
                <CardTitle>Company Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Company Name</Label>
                  <Input
                    value={company_name}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="E-COMWash"
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="financial" className="mt-6">
            <Card className="border-none shadow-lg">
              <CardHeader>
                <CardTitle>Financial Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Default Currency</Label>
                  <Select value={default_currency} onValueChange={setDefaultCurrency}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USD">USD - US Dollar ($)</SelectItem>
                      <SelectItem value="EUR">EUR - Euro (€)</SelectItem>
                      <SelectItem value="GBP">GBP - British Pound (£)</SelectItem>
                      <SelectItem value="SAR">SAR - Saudi Riyal (ر.س)</SelectItem>
                      <SelectItem value="AED">AED - UAE Dirham (د.إ)</SelectItem>
                      <SelectItem value="JPY">JPY - Japanese Yen (¥)</SelectItem>
                      <SelectItem value="CNY">CNY - Chinese Yuan (¥)</SelectItem>
                      <SelectItem value="INR">INR - Indian Rupee (₹)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-slate-500 mt-1">
                    This will change the currency displayed throughout the system
                  </p>
                </div>

                <div>
                  <Label>Default Tax Rate (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={default_tax_rate}
                    onChange={(e) => setDefaultTaxRate(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                  />
                </div>

                <div>
                  <Label>Fiscal Year Start</Label>
                  <Input
                    value={fiscal_year_start}
                    onChange={(e) => setFiscalYearStart(e.target.value)}
                    placeholder="MM-DD"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Enable Tax Calculation</Label>
                    <p className="text-xs text-slate-500">Automatically calculate tax on transactions</p>
                  </div>
                  <Switch checked={tax_enabled} onCheckedChange={setTaxEnabled} />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Auto Generate Invoices</Label>
                    <p className="text-xs text-slate-500">Create invoices automatically for completed wash tickets</p>
                  </div>
                  <Switch checked={auto_invoice} onCheckedChange={setAutoInvoice} />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="operations" className="mt-6">
            <Card className="border-none shadow-lg">
              <CardHeader>
                <CardTitle>Operations Settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Enable Loyalty Program</Label>
                    <p className="text-xs text-slate-500">Allow customers to earn and redeem loyalty points</p>
                  </div>
                  <Switch checked={loyalty_enabled} onCheckedChange={setLoyaltyEnabled} />
                </div>

                <div>
                  <Label>Low Stock Threshold</Label>
                  <Input
                    type="number"
                    value={low_stock_threshold}
                    onChange={(e) => setLowStockThreshold(parseInt(e.target.value) || 10)}
                    placeholder="10"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    Alert when stock falls below this level
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Save Button */}
        <div className="flex justify-end gap-3">
          {showSuccess && (
            <div className="flex items-center gap-2 text-green-600">
              <Check className="w-5 h-5" />
              <span>Settings saved successfully!</span>
            </div>
          )}
          <Button
            onClick={handleSave}
            className="bg-blue-600 hover:bg-blue-700"
            disabled={saveSettingsMutation.isPending}
          >
            <Save className="w-4 h-4 mr-2" />
            {saveSettingsMutation.isPending ? 'Saving...' : 'Save Settings'}
          </Button>
        </div>
      </div>
    </div>
  );
}