import React, { useState, useEffect } from "react";
import { Sliders, Bell, AlertTriangle, ShieldAlert, Check, RotateCcw, X, Volume2, Activity, Zap } from "lucide-react";

export interface EThresholdConfig {
  warningPercent: number; // e.g. 75 (%)
  criticalPercent: number; // e.g. 90 (%)
  lowFloorMargin: number; // e.g. 100 units above floor
  enableVisualAlerts: boolean;
  enableSoundSim: boolean;
  enableAutoRebalanceOnCritical: boolean;
}

export const DEFAULT_E_THRESHOLDS: EThresholdConfig = {
  warningPercent: 75,
  criticalPercent: 90,
  lowFloorMargin: 100,
  enableVisualAlerts: true,
  enableSoundSim: true,
  enableAutoRebalanceOnCritical: false,
};

interface EThresholdConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  eCapacity: number;
  eFloor: number;
  currentE: number;
  thresholds: EThresholdConfig;
  onSave: (config: EThresholdConfig) => void;
}

export const EThresholdConfigModal: React.FC<EThresholdConfigModalProps> = ({
  isOpen,
  onClose,
  eCapacity,
  eFloor,
  currentE,
  thresholds,
  onSave,
}) => {
  const [config, setConfig] = useState<EThresholdConfig>(thresholds);
  const [savedFeedback, setSavedFeedback] = useState<boolean>(false);

  useEffect(() => {
    setConfig(thresholds);
  }, [thresholds, isOpen]);

  if (!isOpen) return null;

  const warningValue = (config.warningPercent / 100) * eCapacity;
  const criticalValue = (config.criticalPercent / 100) * eCapacity;
  const currentPercent = Math.min(100, Math.max(0, (currentE / eCapacity) * 100));

  const isCurrentWarning = currentE >= warningValue && currentE < criticalValue;
  const isCurrentCritical = currentE >= criticalValue;

  const handleApplyPreset = (warning: number, critical: number) => {
    setConfig((prev) => ({
      ...prev,
      warningPercent: warning,
      criticalPercent: critical,
    }));
  };

  const handleResetDefaults = () => {
    setConfig(DEFAULT_E_THRESHOLDS);
  };

  const handleSave = () => {
    onSave(config);
    setSavedFeedback(true);
    setTimeout(() => {
      setSavedFeedback(false);
      onClose();
    }, 600);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="p-5 border-b border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                Core Engine <span className="font-mono text-cyan-400">E(t)</span> Alert Thresholds
              </h2>
              <p className="text-xs text-slate-400">
                Configure real-time capacity monitoring and visual alert triggers for Earth Carrying Capacity $E(t)$
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-100 bg-slate-800/80 hover:bg-slate-800 rounded-lg transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 text-slate-200 text-xs">
          {/* Current Live Capacity Status Indicator */}
          <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
            <div className="flex justify-between items-center font-mono">
              <span className="text-slate-400 text-[11px] font-bold uppercase tracking-wider">
                Current System Capacity Metric E(t)
              </span>
              <span className="text-slate-100 font-bold">
                {currentE.toFixed(1)} / {eCapacity} E_units ({currentPercent.toFixed(1)}%)
              </span>
            </div>

            {/* Visual Capacity Preview Bar with Threshold Markers */}
            <div className="relative pt-3 pb-1">
              <div className="h-3 bg-slate-900 rounded-full overflow-hidden border border-slate-800 relative">
                <div
                  className={`h-full transition-all duration-300 ${
                    isCurrentCritical
                      ? "bg-rose-500"
                      : isCurrentWarning
                      ? "bg-amber-400"
                      : "bg-emerald-400"
                  }`}
                  style={{ width: `${currentPercent}%` }}
                />
              </div>

              {/* Threshold Line Markers */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-amber-400 z-10 flex flex-col items-center"
                style={{ left: `${config.warningPercent}%` }}
                title={`Warning Threshold: ${warningValue.toFixed(0)} E (${config.warningPercent}%)`}
              >
                <div className="w-2 h-2 rounded-full bg-amber-400 -mt-1 shadow" />
              </div>

              <div
                className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-10 flex flex-col items-center"
                style={{ left: `${config.criticalPercent}%` }}
                title={`Critical Threshold: ${criticalValue.toFixed(0)} E (${config.criticalPercent}%)`}
              >
                <div className="w-2 h-2 rounded-full bg-rose-500 -mt-1 shadow" />
              </div>
            </div>

            <div className="flex justify-between text-[10px] font-mono text-slate-500">
              <span>0% (Floor: {eFloor})</span>
              <span className="text-amber-400">Warning: {config.warningPercent}% ({warningValue.toFixed(0)} E)</span>
              <span className="text-rose-400">Critical: {config.criticalPercent}% ({criticalValue.toFixed(0)} E)</span>
              <span>100% ({eCapacity} E)</span>
            </div>
          </div>

          {/* Preset Buttons */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-mono text-slate-400 font-bold uppercase tracking-wider">
              Quick Preset Thresholds
            </span>
            <div className="grid grid-cols-3 gap-2 font-mono">
              <button
                type="button"
                onClick={() => handleApplyPreset(70, 85)}
                className="p-2 bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-xl text-center hover:bg-slate-800 transition cursor-pointer"
              >
                <span className="block font-bold">Aggressive</span>
                <span className="text-[10px] text-amber-400">70% Warn / 85% Crit</span>
              </button>

              <button
                type="button"
                onClick={() => handleApplyPreset(75, 90)}
                className="p-2 bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-xl text-center hover:bg-slate-800 transition cursor-pointer"
              >
                <span className="block font-bold">Standard</span>
                <span className="text-[10px] text-amber-400">75% Warn / 90% Crit</span>
              </button>

              <button
                type="button"
                onClick={() => handleApplyPreset(85, 95)}
                className="p-2 bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 rounded-xl text-center hover:bg-slate-800 transition cursor-pointer"
              >
                <span className="block font-bold">Relaxed</span>
                <span className="text-[10px] text-amber-400">85% Warn / 95% Crit</span>
              </button>
            </div>
          </div>

          {/* Threshold Sliders & Inputs */}
          <div className="space-y-4 pt-2 border-t border-slate-800">
            {/* Warning Threshold Slider */}
            <div className="p-3 bg-slate-950 border border-amber-500/20 rounded-xl space-y-2">
              <div className="flex justify-between items-center font-mono">
                <label className="flex items-center gap-1.5 font-bold text-amber-300">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span>Warning Threshold Level</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={10}
                    max={config.criticalPercent - 1}
                    value={config.warningPercent}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        warningPercent: Math.min(
                          config.criticalPercent - 1,
                          Math.max(10, Number(e.target.value))
                        ),
                      })
                    }
                    className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-right font-mono text-amber-300 font-bold focus:outline-none focus:border-amber-500"
                  />
                  <span className="text-slate-400 font-bold">%</span>
                  <span className="text-[10px] text-slate-500 font-normal">
                    ({warningValue.toFixed(0)} E)
                  </span>
                </div>
              </div>
              <input
                type="range"
                min={20}
                max={config.criticalPercent - 1}
                step={1}
                value={config.warningPercent}
                onChange={(e) => setConfig({ ...config, warningPercent: Number(e.target.value) })}
                className="w-full accent-amber-400 cursor-pointer"
              />
            </div>

            {/* Critical Threshold Slider */}
            <div className="p-3 bg-slate-950 border border-rose-500/20 rounded-xl space-y-2">
              <div className="flex justify-between items-center font-mono">
                <label className="flex items-center gap-1.5 font-bold text-rose-300">
                  <ShieldAlert className="w-4 h-4 text-rose-400" />
                  <span>Critical Capacity Breach Level</span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={config.warningPercent + 1}
                    max={100}
                    value={config.criticalPercent}
                    onChange={(e) =>
                      setConfig({
                        ...config,
                        criticalPercent: Math.min(
                          100,
                          Math.max(config.warningPercent + 1, Number(e.target.value))
                        ),
                      })
                    }
                    className="w-16 bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-right font-mono text-rose-300 font-bold focus:outline-none focus:border-rose-500"
                  />
                  <span className="text-slate-400 font-bold">%</span>
                  <span className="text-[10px] text-slate-500 font-normal">
                    ({criticalValue.toFixed(0)} E)
                  </span>
                </div>
              </div>
              <input
                type="range"
                min={config.warningPercent + 1}
                max={100}
                step={1}
                value={config.criticalPercent}
                onChange={(e) => setConfig({ ...config, criticalPercent: Number(e.target.value) })}
                className="w-full accent-rose-500 cursor-pointer"
              />
            </div>

            {/* Low Floor Margin Setting */}
            <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
              <div className="flex justify-between items-center font-mono">
                <label className="text-slate-300 font-bold">
                  Operational Floor Margin Warning
                </label>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">Floor +</span>
                  <input
                    type="number"
                    min={10}
                    max={500}
                    value={config.lowFloorMargin}
                    onChange={(e) => setConfig({ ...config, lowFloorMargin: Number(e.target.value) })}
                    className="w-20 bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-right font-mono text-slate-200 font-bold focus:outline-none focus:border-cyan-500"
                  />
                  <span className="text-slate-400">E</span>
                </div>
              </div>
              <p className="text-[10px] text-slate-500">
                Trigger low capacity warning if E(t) drops below {eFloor + config.lowFloorMargin} E_units.
              </p>
            </div>
          </div>

          {/* Toggle Options */}
          <div className="space-y-2 pt-2 border-t border-slate-800 font-mono">
            <span className="text-[11px] text-slate-400 font-bold uppercase tracking-wider block">
              Alert Trigger Behaviors
            </span>

            <label className="flex items-center justify-between p-2.5 bg-slate-950 border border-slate-800 rounded-xl cursor-pointer hover:bg-slate-900/50 transition">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-cyan-400" />
                <span>Enable High-Visibility Visual Warning Banners</span>
              </div>
              <input
                type="checkbox"
                checked={config.enableVisualAlerts}
                onChange={(e) => setConfig({ ...config, enableVisualAlerts: e.target.checked })}
                className="w-4 h-4 accent-cyan-500 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-2.5 bg-slate-950 border border-slate-800 rounded-xl cursor-pointer hover:bg-slate-900/50 transition">
              <div className="flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-purple-400" />
                <span>Enable Audio Pulse Alert Simulation</span>
              </div>
              <input
                type="checkbox"
                checked={config.enableSoundSim}
                onChange={(e) => setConfig({ ...config, enableSoundSim: e.target.checked })}
                className="w-4 h-4 accent-purple-500 cursor-pointer"
              />
            </label>

            <label className="flex items-center justify-between p-2.5 bg-slate-950 border border-slate-800 rounded-xl cursor-pointer hover:bg-slate-900/50 transition">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-400" />
                <span>Auto-Trigger Equalizer Pulse on Critical Breach</span>
              </div>
              <input
                type="checkbox"
                checked={config.enableAutoRebalanceOnCritical}
                onChange={(e) => setConfig({ ...config, enableAutoRebalanceOnCritical: e.target.checked })}
                className="w-4 h-4 accent-emerald-500 cursor-pointer"
              />
            </label>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <button
            type="button"
            onClick={handleResetDefaults}
            className="px-3 py-1.5 text-xs font-mono text-slate-400 hover:text-slate-200 flex items-center gap-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl transition cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset Defaults</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-mono text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 text-xs font-mono font-bold text-white bg-cyan-600 hover:bg-cyan-500 rounded-xl transition shadow-lg shadow-cyan-950/50 flex items-center gap-1.5 cursor-pointer"
            >
              {savedFeedback ? (
                <>
                  <Check className="w-4 h-4 text-emerald-300" />
                  <span>SAVED!</span>
                </>
              ) : (
                <span>SAVE THRESHOLDS</span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
