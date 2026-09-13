import { useNavigate } from 'react-router-dom';
import ReportForm from '../../components/reports/ReportForm.jsx';
import CitizenLayout from '../../components/citizen/CitizenLayout.jsx';
import { reportsApi } from '../../services/reportService.js';
import { apiMessage } from '../../services/api.js';
import { useState } from 'react';
export default function CreateReport() { const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const navigate = useNavigate(); async function save(values) { setBusy(true); setError(''); try { const { data } = await reportsApi.create(values); navigate(`/dashboard/citizen/reports/${data.report._id}`); } catch (err) { setError(apiMessage(err)); } finally { setBusy(false); } } return <CitizenLayout title="Create a report"><div className="mx-auto max-w-3xl"><p className="mb-5 text-slate-600">Tell us what needs attention. We’ll send it to the selected civic department.</p>{error && <p className="mb-4 rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}<ReportForm onSave={save} busy={busy} /></div></CitizenLayout>; }
