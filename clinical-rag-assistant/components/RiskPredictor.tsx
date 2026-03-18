
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { clinicalApi } from '../services/api';
import { PredictionResponse, PredictRequest } from '../types';
import { AlertIcon, HeartIcon, LibraryIcon } from './Icons';

const defaultPatient: PredictRequest = {
  age: 65,
  anaemia: 0,
  creatinine_phosphokinase: 250,
  diabetes: 0,
  ejection_fraction: 38,
  high_blood_pressure: 1,
  platelets: 263358,
  serum_creatinine: 1.3,
  serum_sodium: 136,
  sex: 1,
  smoking: 0,
};

const fieldConfig: { key: keyof PredictRequest; label: string; type: 'number' | 'toggle'; step?: number; unit?: string }[] = [
  { key: 'age', label: 'Age', type: 'number', unit: 'years' },
  { key: 'ejection_fraction', label: 'Ejection Fraction', type: 'number', unit: '%' },
  { key: 'serum_creatinine', label: 'Serum Creatinine', type: 'number', step: 0.1, unit: 'mg/dL' },
  { key: 'serum_sodium', label: 'Serum Sodium', type: 'number', unit: 'mEq/L' },
  { key: 'creatinine_phosphokinase', label: 'CPK Level', type: 'number', unit: 'mcg/L' },
  { key: 'platelets', label: 'Platelets', type: 'number', unit: '/µL' },
  { key: 'anaemia', label: 'Anaemia', type: 'toggle' },
  { key: 'diabetes', label: 'Diabetes', type: 'toggle' },
  { key: 'high_blood_pressure', label: 'Hypertension', type: 'toggle' },
  { key: 'sex', label: 'Sex (M/F)', type: 'toggle' },
  { key: 'smoking', label: 'Smoking', type: 'toggle' },
];

const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.15, duration: 0.5, ease: [0.34, 1.56, 0.64, 1] }
  })
};

export const RiskPredictor: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<PredictionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [patient, setPatient] = useState<PredictRequest>({ ...defaultPatient });

  const updateField = (key: keyof PredictRequest, value: number) => {
    setPatient(prev => ({ ...prev, [key]: value }));
  };

  const handlePredict = async () => {
    setIsLoading(true);
    setError(null);
    setResult(null);
    try {
      const prediction = await clinicalApi.predict(patient);
      setResult(prediction);
    } catch (err: any) {
      setError(err.message || 'Failed to process prediction.');
    } finally {
      setIsLoading(false);
    }
  };

  const getRiskColor = (prob: number) => {
    if (prob < 0.2) return { bg: 'bg-emerald-500', text: 'text-emerald-500', ring: '#10b981', label: 'Low Risk' };
    if (prob < 0.5) return { bg: 'bg-amber-500', text: 'text-amber-500', ring: '#f59e0b', label: 'Moderate' };
    return { bg: 'bg-rose-500', text: 'text-rose-500', ring: '#e11d48', label: 'High Risk' };
  };

  const getTrendText = (res: PredictionResponse) => {
    const diff = res.risk_30d - res.risk_1d;
    if (diff > 0.1) return { text: 'Increasing Risk', color: 'text-rose-500', bg: 'bg-rose-50 border-rose-200', icon: '↑' };
    if (diff < -0.1) return { text: 'Decreasing Risk', color: 'text-emerald-500', bg: 'bg-emerald-50 border-emerald-200', icon: '↓' };
    return { text: 'Stable Trend', color: 'text-slate-500', bg: 'bg-slate-50 border-slate-200', icon: '→' };
  };

  const RiskCard = ({ title, prob, label, index }: { title: string, prob: number, label: string, index: number }) => {
    const risk = getRiskColor(prob);
    const circumference = 2 * Math.PI * 54;
    const offset = circumference * (1 - prob);

    return (
      <motion.div
        custom={index}
        initial="hidden"
        animate="visible"
        variants={cardVariants}
        className="glass-card p-8 flex flex-col items-center text-center"
      >
        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">{label}</span>
        <h4 className="text-lg font-bold text-slate-800 mb-5">{title}</h4>
        <div className="relative w-32 h-32 flex items-center justify-center">
          <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="54" stroke="#f1f5f9" strokeWidth="8" fill="transparent" />
            <motion.circle
              cx="60" cy="60" r="54"
              stroke={risk.ring}
              strokeWidth="8"
              fill="transparent"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 1.2, ease: 'easeOut', delay: index * 0.2 }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.span
              className="text-3xl font-black text-slate-800"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 + index * 0.2 }}
            >
              {(prob * 100).toFixed(0)}%
            </motion.span>
          </div>
        </div>
        <div className={`mt-6 px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-white ${risk.bg}`}>
          {risk.label}
        </div>
      </motion.div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto py-6 pb-32">
      {/* Gradient Header */}
      <div className="page-gradient-header">
        <div className="header-badge">
          <span className="dot"></span>
          Predictive Analytics
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-rose-600 p-2.5 rounded-xl" style={{ position: 'relative', zIndex: 1 }}>
            <AlertIcon className="w-6 h-6 text-white" />
          </div>
          <div style={{ position: 'relative', zIndex: 1 }}>
            <h2>ML Risk Forecaster</h2>
            <p>Multi-horizon heart failure mortality prediction using ensemble ML models</p>
          </div>
        </div>
      </div>

      {/* Patient Parameters Form */}
      <motion.div
        className="glass-card p-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="section-label">
          <HeartIcon className="w-3.5 h-3.5" />
          <span>Clinical Parameters</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-5">
          {fieldConfig.map(({ key, label, type, step, unit }) => (
            <div key={key}>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-2 tracking-wider">
                {label} {unit && <span className="text-slate-300 normal-case">({unit})</span>}
              </label>
              {type === 'number' ? (
                <input
                  type="number"
                  step={step || 1}
                  value={patient[key]}
                  onChange={(e) => updateField(key, parseFloat(e.target.value) || 0)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent text-sm font-medium transition-all"
                />
              ) : (
                <button
                  onClick={() => updateField(key, patient[key] === 1 ? 0 : 1)}
                  className={`w-full px-4 py-2.5 rounded-xl text-sm font-bold transition-all border-2 ${patient[key] === 1
                    ? 'bg-rose-600 text-white border-rose-600 shadow-md shadow-rose-200'
                    : 'bg-slate-50 text-slate-500 border-slate-200 hover:border-slate-300'
                    }`}
                >
                  {patient[key] === 1 ? 'Yes' : 'No'}
                </button>
              )}
            </div>
          ))}
        </div>
      </motion.div>

      {/* Predict Button */}
      <motion.div className="flex justify-center mt-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <button
          onClick={handlePredict}
          disabled={isLoading}
          className="btn-primary flex items-center gap-3 px-8 py-3.5 text-base"
        >
          <HeartIcon className="w-5 h-5" />
          {isLoading ? 'Analysing...' : 'Generate Clinical Risk Profile'}
        </button>
      </motion.div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 bg-rose-50 text-rose-700 p-4 rounded-2xl border border-rose-200 text-sm"
        >
          {error}
        </motion.div>
      )}

      {result && (
        <motion.div
          className="mt-10 space-y-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {/* Risk Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <RiskCard title="1-Day Risk" prob={result.risk_1d} label="Immediate" index={0} />
            <RiskCard title="7-Day Risk" prob={result.risk_7d} label="Short Term" index={1} />
            <RiskCard title="30-Day Risk" prob={result.risk_30d} label="Monthly" index={2} />
          </div>

          {/* Trajectory Chart */}
          <motion.div
            className="glass-card p-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
          >
            <div className="flex items-center justify-between mb-8">
              <div>
                <div className="section-label" style={{ marginBottom: '0.25rem' }}>
                  <span>Risk Trajectory</span>
                </div>
                <h3 className="text-xl font-bold text-slate-800">Temporal Risk Analysis</h3>
              </div>
              <div className={`px-4 py-1.5 rounded-xl font-bold text-sm border ${getTrendText(result).color} ${getTrendText(result).bg}`}>
                {getTrendText(result).icon} {getTrendText(result).text}
              </div>
            </div>

            <div className="relative" style={{ height: '220px' }}>
              {/* Y-axis labels and grid lines */}
              {[0, 25, 50, 75, 100].map(pct => (
                <div key={pct} className="absolute left-0 right-0 flex items-center" style={{ bottom: `${pct}%` }}>
                  <span className="text-[10px] text-slate-300 w-8 text-right pr-2 font-mono">{pct}%</span>
                  <div className="flex-1 border-t border-slate-100" />
                </div>
              ))}

              {/* Chart area */}
              <div className="absolute left-10 right-4 top-2 bottom-6">
                {(() => {
                  const risks = [result.risk_1d, result.risk_7d, result.risk_30d];
                  const labels = ['Day 1', 'Day 7', 'Day 30'];
                  const positions = [0, 50, 100]; // % positions

                  return (
                    <>
                      {/* SVG line + area fill */}
                      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                        <defs>
                          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="rgba(225,29,72,0.15)" />
                            <stop offset="100%" stopColor="rgba(225,29,72,0)" />
                          </linearGradient>
                          <linearGradient id="lineGrad2" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#10b981" />
                            <stop offset="50%" stopColor="#f59e0b" />
                            <stop offset="100%" stopColor="#e11d48" />
                          </linearGradient>
                        </defs>
                        {/* Area fill */}
                        <motion.path
                          d={`M 0,${100 - risks[0] * 100} L 50,${100 - risks[1] * 100} L 100,${100 - risks[2] * 100} L 100,100 L 0,100 Z`}
                          fill="url(#areaGrad)"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.8, duration: 0.6 }}
                        />
                        {/* Line */}
                        <motion.polyline
                          points={`0,${100 - risks[0] * 100} 50,${100 - risks[1] * 100} 100,${100 - risks[2] * 100}`}
                          fill="none"
                          stroke="url(#lineGrad2)"
                          strokeWidth="2"
                          vectorEffect="non-scaling-stroke"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          initial={{ pathLength: 0 }}
                          animate={{ pathLength: 1 }}
                          transition={{ duration: 1.5, ease: 'easeInOut', delay: 0.3 }}
                        />
                      </svg>

                      {/* Data points (HTML elements so they don't stretch) */}
                      {risks.map((risk, i) => (
                        <motion.div
                          key={i}
                          className="absolute flex flex-col items-center"
                          style={{
                            left: `${positions[i]}%`,
                            bottom: `${risk * 100}%`,
                            transform: 'translate(-50%, 50%)',
                          }}
                          initial={{ opacity: 0, scale: 0 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.6 + i * 0.2, type: 'spring', stiffness: 300 }}
                        >
                          {/* Value label */}
                          <span className="text-[11px] font-bold mb-1.5" style={{ color: getRiskColor(risk).ring }}>
                            {(risk * 100).toFixed(1)}%
                          </span>
                          {/* Dot */}
                          <div
                            className="w-4 h-4 rounded-full border-[3px] bg-white shadow-sm"
                            style={{ borderColor: getRiskColor(risk).ring }}
                          />
                        </motion.div>
                      ))}

                      {/* X-axis labels */}
                      {labels.map((label, i) => (
                        <span
                          key={label}
                          className="absolute text-[10px] text-slate-400 font-medium"
                          style={{
                            left: `${positions[i]}%`,
                            bottom: '-22px',
                            transform: 'translateX(-50%)',
                          }}
                        >
                          {label}
                        </span>
                      ))}
                    </>
                  );
                })()}
              </div>
            </div>
          </motion.div>


          {/* SHAP-style Feature Importance */}
          <motion.div
            className="glass-card p-8"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
          >
            <div className="section-label" style={{ marginBottom: '0.25rem' }}>
              <span>Feature Importance</span>
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-1">Clinical Driver Analysis</h3>
            <p className="text-xs text-slate-400 mb-6">Estimated contribution of each parameter to risk score</p>
            {(() => {
              // Pseudo-SHAP: assign clinical weights × deviation from median population
              const popMedian: Record<keyof PredictRequest, number> = {
                age: 60, ejection_fraction: 55, serum_creatinine: 1.0, serum_sodium: 137,
                creatinine_phosphokinase: 200, platelets: 262000,
                anaemia: 0, diabetes: 0, high_blood_pressure: 0, sex: 1, smoking: 0
              };
              const weights: Record<keyof PredictRequest, number> = {
                ejection_fraction: -0.45, age: 0.30, serum_creatinine: 0.25,
                high_blood_pressure: 0.18, anaemia: 0.15, serum_sodium: -0.20,
                diabetes: 0.10, smoking: 0.08, creatinine_phosphokinase: 0.06,
                platelets: -0.04, sex: -0.03
              };
              const labels: Record<keyof PredictRequest, string> = {
                ejection_fraction: 'Ejection Fraction', age: 'Age', serum_creatinine: 'Serum Creatinine',
                high_blood_pressure: 'Hypertension', anaemia: 'Anaemia', serum_sodium: 'Serum Sodium',
                diabetes: 'Diabetes', smoking: 'Smoking', creatinine_phosphokinase: 'CPK',
                platelets: 'Platelets', sex: 'Sex'
              };
              const contributions = (Object.keys(weights) as (keyof PredictRequest)[]).map(k => {
                const norm = typeof patient[k] === 'number' && typeof popMedian[k] === 'number'
                  ? (patient[k] as number - popMedian[k]) / Math.max(Math.abs(popMedian[k]), 1)
                  : (patient[k] as number) - 0.5;
                const impact = weights[k] * norm;
                return { key: k, label: labels[k], impact, pct: Math.abs(impact) * 100 };
              }).sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact)).slice(0, 7);
              const maxPct = Math.max(...contributions.map(c => c.pct), 1);
              return (
                <div className="space-y-3">
                  {contributions.map((c, i) => (
                    <motion.div key={c.key}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.8 + i * 0.05 }}
                      className="flex items-center gap-3"
                    >
                      <span className="text-xs text-slate-500 w-36 text-right flex-shrink-0 truncate">{c.label}</span>
                      <div className="flex-1 flex items-center gap-2">
                        {/* Center line */}
                        <div className="flex-1 relative h-5 flex items-center">
                          <div className="absolute inset-0 flex items-center">
                            <div className="w-full h-px bg-slate-100" />
                          </div>
                          <motion.div
                            className={`absolute h-4 rounded-full ${c.impact > 0 ? 'bg-rose-400 left-1/2' : 'bg-emerald-400 right-1/2'}`}
                            style={{ width: 0 }}
                            animate={{ width: `${(c.pct / maxPct) * 50}%` }}
                            transition={{ delay: 0.9 + i * 0.05, duration: 0.6, ease: 'easeOut' }}
                          />
                        </div>
                        <span className={`text-[10px] font-bold font-mono w-10 flex-shrink-0 ${c.impact > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                          {c.impact > 0 ? '+' : ''}{(c.impact * 100).toFixed(0)}%
                        </span>
                      </div>
                    </motion.div>
                  ))}
                  <div className="flex gap-4 mt-4 pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-rose-400" /><span className="text-xs text-slate-500">Increases risk</span></div>
                    <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded bg-emerald-400" /><span className="text-xs text-slate-500">Protective</span></div>
                  </div>
                </div>
              );
            })()}
          </motion.div>

          {/* Export Button */}
          <motion.button
            onClick={() => window.print()}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="w-full bg-white text-slate-600 py-3.5 rounded-xl font-bold hover:bg-slate-50 transition-all flex items-center justify-center gap-2 border border-slate-200 hover:border-slate-300 hover:shadow-sm"
          >
            <LibraryIcon className="w-4 h-4" />
            Export Clinical Summary (PDF)
          </motion.button>
        </motion.div>
      )}
    </div>
  );
};
