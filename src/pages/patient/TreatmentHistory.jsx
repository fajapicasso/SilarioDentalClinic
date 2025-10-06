import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowLeft, FiPrinter, FiFileText, FiCalendar, FiUser } from 'react-icons/fi';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import logo from '../../assets/Logo.png';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import supabase from '../../config/supabaseClient';
import LoadingSpinner from '../../components/common/LoadingSpinner';

const TreatmentHistory = () => {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [treatments, setTreatments] = useState([]);
  const [patient, setPatient] = useState(null);
  // Filters / paging
  const [searchQuery, setSearchQuery] = useState('');
  const [startDate, setStartDate] = useState(null);
  const [toothFilter, setToothFilter] = useState('all');
  const [itemsPerPage, setItemsPerPage] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [procedureFilter, setProcedureFilter] = useState('all');
  const [services, setServices] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) throw error;
        const patientId = user?.id;
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', patientId)
          .single();
        setPatient(profile);
        const { data } = await supabase
          .from('treatments')
          .select('id, procedure, tooth_number, diagnosis, notes, treatment_date, doctor:doctor_id (full_name)')
          .eq('patient_id', patientId)
          .order('treatment_date', { ascending: false });
        setTreatments(data || []);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, []);

  // Load services for procedure filter (admin service management)
  useEffect(() => {
    const loadServices = async () => {
      const { data } = await supabase.from('services').select('id, name').order('name');
      setServices(data || []);
    };
    loadServices();
  }, []);

  const formatDate = (d) => (d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '');

  const buildReportHtml = () => {
    const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '');
    const today = new Date().toLocaleString('en-US');
    const records = filteredTreatments();
    const calcAge = (b) => {
      if (!b) return '';
      const birth = new Date(b);
      const now = new Date();
      let age = now.getFullYear() - birth.getFullYear();
      const m = now.getMonth() - birth.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
      return String(age);
    };
    return `<!doctype html><html><head><meta charset="utf-8" />
    <title>Treatment History - ${patient?.full_name || ''}</title>
    <style>
      *{box-sizing:border-box}
      body{font-family:Arial,Helvetica,sans-serif;color:#111;margin:0;padding:16px;background:#fff}
      .header{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
      .clinic{display:flex;align-items:center;gap:12px}
      .clinic img{height:36px;width:auto}
      .clinic-name{font-weight:700;font-size:16px}
      .meta{font-size:12px;color:#555}
      .submeta{font-size:11px;color:#666}
      .title{text-align:center;font-weight:700;margin:12px 0 16px 0}
      .card{border:1px solid #ddd;border-radius:6px;overflow:hidden;margin-bottom:16px}
      .card .card-h{background:#f7f7fb;padding:10px 12px;font-weight:700;font-size:13px;border-bottom:1px solid #e5e7eb}
      .card .card-b{padding:8px 12px}
      .grid{display:grid;grid-template-columns:1fr 1fr;gap:4px 16px}
      .row{display:flex;border-bottom:1px solid #f3f4f6;padding:4px 0;line-height:1.2}
      .label{width:128px;font-weight:600;font-size:12px;color:#333}
      .value{flex:1;font-size:12px}
      table{width:100%;border-collapse:collapse}
      thead th{background:#f3f4f6;border:1px solid #e5e7eb;font-size:12px;padding:8px;text-align:left}
      tbody td{border:1px solid #e5e7eb;font-size:12px;padding:8px;vertical-align:top}
      td.doctor{white-space:nowrap}
      tfoot td{font-size:11px;color:#555;padding:6px}
      .right{text-align:right}
      @media print{body{padding:12px}}
    </style></head>
    <body>
      <div class="header">
        <div class="clinic">
          <img src="${logo}" onerror="this.style.display='none'" alt="Clinic Logo" />
          <div>
            <div class="clinic-name">SILARIO DENTAL CLINIC</div>
            <div class="submeta">Cabugao/San Juan, Ilocos Sur • silariodentalclinic@gmail.com</div>
            <div class="meta">Elaine Mae Frando Silario, D.M.D</div>
          </div>
        </div>
        <div class="meta">
          <div>Date: ${fmt(new Date())}</div>
          <div>Patient: ${patient?.full_name || ''}</div>
        </div>
      </div>

      <div class="title">Dental Treatment History Record</div>

      <div class="card">
        <div class="card-h">Patient Information</div>
        <div class="card-b">
          <div class="grid">
            <div class="row"><div class="label">Name</div><div class="value">${patient?.full_name || ''}</div></div>
            <div class="row"><div class="label">Age</div><div class="value">${calcAge(patient?.birthday)}</div></div>
            <div class="row"><div class="label">Address</div><div class="value">${patient?.address || ''}</div></div>
            <div class="row"><div class="label">Sex</div><div class="value">${patient?.gender ? patient.gender[0].toUpperCase()+patient.gender.slice(1) : ''}</div></div>
            <div class="row"><div class="label">Birthdate</div><div class="value">${fmt(patient?.birthday)}</div></div>
            <div class="row"><div class="label">Date</div><div class="value">${fmt(new Date())}</div></div>
            <div class="row"><div class="label">Nationality</div><div class="value">${patient?.nationality || ''}</div></div>
            <div class="row"><div class="label">Home No.</div><div class="value">${patient?.phone || ''}</div></div>
            <div class="row"><div class="label">Home Address</div><div class="value">${patient?.address || ''}</div></div>
            <div class="row"><div class="label">Office No.</div><div class="value">${patient?.office_phone || ''}</div></div>
            <div class="row"><div class="label">Occupation</div><div class="value">${patient?.occupation || ''}</div></div>
            <div class="row"><div class="label">Cell/Mobile</div><div class="value">${patient?.mobile || patient?.phone || ''}</div></div>
            <div class="row"><div class="label">Patient ID</div><div class="value">${patient?.id ? patient.id.substring(0,8) : ''}</div></div>
            <div class="row"><div class="label">Email</div><div class="value">${patient?.email || ''}</div></div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-h">Treatment History Summary (${records.length} Records)</div>
        <div class="card-b">
          <table>
            <thead>
              <tr>
                <th style="width:14%">Date</th>
                <th style="width:24%">Procedure</th>
                <th style="width:8%">Tooth #</th>
                <th style="width:22%">Treatment Plan</th>
                <th style="width:22%">Notes</th>
                <th style="width:14%">Doctor</th>
              </tr>
            </thead>
            <tbody>
              ${records.map(t=>`
                <tr>
                  <td>${fmt(t.treatment_date)}</td>
                  <td><strong>${t.procedure || ''}</strong></td>
                  <td class="right">${t.tooth_number || '-'}</td>
                  <td>${t.diagnosis || '-'}</td>
                  <td>${t.notes || '-'}</td>
                  <td class="doctor">Dr. ${t.doctor?.full_name || 'Unknown'}</td>
                </tr>
              `).join('')}
            </tbody>
            <tfoot>
              <tr><td colspan="6">Generated on ${today}</td></tr>
            </tfoot>
          </table>
        </div>
      </div>
    </body></html>`;
  };

  const handlePrint = () => {
    try {
      const w = window.open('', '_blank');
      if (!w) return;
      const html = buildReportHtml();
      w.document.open();
      w.document.write(html);
      w.document.close();
      w.onload = () => w.print();
    } catch {}
  };

  const handleDownloadPdf = async () => {
    try {
      const html = buildReportHtml();
      const parser = new DOMParser();
      const parsed = parser.parseFromString(html, 'text/html');

      const container = document.createElement('div');
      container.style.position = 'fixed';
      container.style.left = '-10000px';
      container.style.top = '0';
      container.style.width = '794px';
      container.style.background = '#fff';

      // Copy styles from the template
      const styleEl = parsed.querySelector('style');
      if (styleEl) {
        const cloneStyle = document.createElement('style');
        cloneStyle.textContent = styleEl.textContent || '';
        container.appendChild(cloneStyle);
      }
      // Move all body children
      Array.from(parsed.body.childNodes).forEach((n) => container.appendChild(n.cloneNode(true)));
      document.body.appendChild(container);

      // Wait for images to load
      const images = Array.from(container.querySelectorAll('img'));
      await Promise.all(images.map(img => new Promise(res => { if (img.complete) res(); else { img.onload = img.onerror = () => res(); } })));

      // Render container to canvas (more reliable than jsPDF.html across browsers)
      const canvas = await html2canvas(container, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const pdf = new jsPDF('p', 'pt', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const marginPt = 43; // ~1.5 cm
      const sideMargin = marginPt;
      const topMarginFirst = marginPt;
      const topMarginNext = marginPt; // same top margin for continuation
      const bottomMargin = marginPt;
      const contentWidthPt = pageWidth - sideMargin * 2;
      const pxPerPt = canvas.width / contentWidthPt; // canvas px per PDF point at our width

      // Helper to add a vertical slice of the canvas at a target Y in PDF
      const addSlice = (startPx, heightPx, destYpt) => {
        const sliceCanvas = document.createElement('canvas');
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = heightPx;
        const ctx = sliceCanvas.getContext('2d');
        ctx.drawImage(canvas, 0, startPx, canvas.width, heightPx, 0, 0, canvas.width, heightPx);
        const dataUrl = sliceCanvas.toDataURL('image/jpeg', 0.95);
        const heightPt = heightPx / pxPerPt;
        pdf.addImage(dataUrl, 'JPEG', sideMargin, destYpt, contentWidthPt, heightPt);
        return heightPt;
      };

      // Measure the table header to repeat it on subsequent pages
      const theadEl = container.querySelector('thead');
      let headStartPx = 0;
      let headHeightPx = 0;
      if (theadEl) {
        const containerRect = container.getBoundingClientRect();
        const headRect = theadEl.getBoundingClientRect();
        headStartPx = Math.max(0, Math.round((headRect.top - containerRect.top) * (canvas.height / container.offsetHeight)));
        headHeightPx = Math.round(headRect.height * (canvas.height / container.offsetHeight));
      }

      // Pagination in canvas pixel space
      let cursorPx = 0;
      const firstPageCapacityPx = Math.floor((pageHeight - topMarginFirst - bottomMargin) * pxPerPt);
      const nextPageCapacityPx = Math.floor((pageHeight - topMarginNext - bottomMargin) * pxPerPt);

      // First page slice
      const firstHeightPx = Math.min(canvas.height, firstPageCapacityPx);
      addSlice(0, firstHeightPx, topMarginFirst);
      cursorPx += firstHeightPx;

      // Subsequent pages with repeated table header and top margin
      while (cursorPx < canvas.height) {
        pdf.addPage('a4', 'p');
        let yPt = topMarginNext;
        // If we have a header, draw it at the top of each subsequent page
        if (headHeightPx > 0) {
          addSlice(headStartPx, headHeightPx, yPt);
          yPt += headHeightPx / pxPerPt; // advance by header height in points
        }
        const remainingCapacityPx = Math.max(0, Math.floor((pageHeight - yPt - bottomMargin) * pxPerPt));
        const sliceHeightPx = Math.min(canvas.height - cursorPx, remainingCapacityPx);
        if (sliceHeightPx <= 0) break;
        addSlice(cursorPx, sliceHeightPx, yPt);
        cursorPx += sliceHeightPx;
      }
      const safeName = (patient?.full_name || 'patient').replace(/[^a-z0-9\-\s]/gi, ' ').trim();
      pdf.save(`Treatment History - ${safeName}.pdf`);
      document.body.removeChild(container);
    } catch {}
  };

  // Stats
  const totalTreatments = treatments.length;
  const uniqueProcedures = new Set(treatments.map(t => t.procedure).filter(Boolean)).size;
  const uniqueTeeth = new Set(treatments.map(t => t.tooth_number).filter(Boolean)).size;
  const lastVisit = treatments[0]?.treatment_date || null;

  // Filter helpers
  const filteredTreatments = () => {
    let list = treatments;
    const toYmd = (d) => {
      if (!d) return '';
      const dt = new Date(d);
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, '0');
      const day = String(dt.getDate()).padStart(2, '0');
      return `${y}-${m}-${day}`;
    };
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter(t =>
        (t.procedure || '').toLowerCase().includes(q) ||
        (t.diagnosis || '').toLowerCase().includes(q) ||
        (t.notes || '').toLowerCase().includes(q)
      );
    }
    // If a date is selected, match EXACT day (not whole month)
    if (startDate) {
      const selectedYmd = toYmd(startDate);
      list = list.filter(t => toYmd(t.treatment_date) === selectedYmd);
    }
    // End date removed per new UI
    if (toothFilter !== 'all') list = list.filter(t => String(t.tooth_number) === toothFilter);
    if (procedureFilter !== 'all') list = list.filter(t => (t.procedure || '') === procedureFilter);
    return list;
  };

  // Teeth options 1..32
  const teethOptions = Array.from({ length: 32 }, (_, i) => i + 1);

  // Pagination
  const paged = () => {
    const list = filteredTreatments();
    const start = (currentPage - 1) * itemsPerPage;
    return list.slice(start, start + itemsPerPage);
  };
  const totalPages = Math.max(1, Math.ceil(filteredTreatments().length / itemsPerPage));

  if (isLoading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate(-1)} className="inline-flex items-center px-3 py-1 text-sm rounded-md border bg-gray-100 hover:bg-gray-200 text-gray-800">
            <FiArrowLeft className="mr-1"/> Back
          </button>
          <h1 className="text-xl font-bold">Treatment History - {patient?.full_name || ''}</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={handlePrint} className="inline-flex items-center px-3 py-1 text-sm rounded-md border bg-blue-600 hover:bg-blue-700 text-white">
            <FiPrinter className="mr-1"/> Print
          </button>
          <button onClick={handleDownloadPdf} className="inline-flex items-center px-3 py-1 text-sm rounded-md border bg-green-600 hover:bg-green-700 text-white">
            Download PDF
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-lg border bg-white p-4">
          <div className="text-xs text-gray-600">Total Treatments</div>
          <div className="text-2xl font-bold mt-1">{totalTreatments}</div>
        </div>
        <div className="rounded-lg border bg-green-50 p-4">
          <div className="text-xs text-green-800">Procedures</div>
          <div className="text-2xl font-bold text-green-700 mt-1">{uniqueProcedures}</div>
        </div>
        <div className="rounded-lg border bg-yellow-50 p-4">
          <div className="text-xs text-yellow-900">Teeth Treated</div>
          <div className="text-2xl font-bold text-yellow-800 mt-1">{uniqueTeeth}</div>
        </div>
        <div className="rounded-lg border bg-purple-50 p-4">
          <div className="text-xs text-purple-800">Last Visit</div>
          <div className="text-sm font-semibold text-purple-900 mt-1">{lastVisit ? formatDate(lastVisit) : '—'}</div>
        </div>
      </div>

      {/* Filters row */}
      <div className="mt-4 bg-white border rounded-lg p-3">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
          <input
            value={searchQuery}
            onChange={e=>{setSearchQuery(e.target.value); setCurrentPage(1);}}
            placeholder="Search treatments..."
            className="lg:col-span-3 px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <div className="lg:col-span-2">
            <DatePicker
              selected={startDate}
              onChange={(d)=>{setStartDate(d); setCurrentPage(1);}}
              placeholderText="Select date"
              className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              popperPlacement="bottom-start"
              showPopperArrow
              isClearable
              dateFormat="MMMM d, yyyy"
            />
          </div>
          <select
            value={procedureFilter}
            onChange={e=>{setProcedureFilter(e.target.value); setCurrentPage(1);}}
            className="lg:col-span-2 px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Procedures</option>
            {services.map(s => (
              <option key={s.id} value={s.name}>{s.name}</option>
            ))}
          </select>
          <select
            value={toothFilter}
            onChange={e=>{setToothFilter(e.target.value); setCurrentPage(1);}}
            className="lg:col-span-1 px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Teeth</option>
            {teethOptions.map(t => (<option key={t} value={String(t)}>{t}</option>))}
          </select>
          <div className="lg:col-span-2 flex gap-2">
            <select
              value={itemsPerPage}
              onChange={e=>{setItemsPerPage(parseInt(e.target.value)); setCurrentPage(1);}}
              className="flex-1 px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value={10}>10 per page</option>
              <option value={20}>20 per page</option>
              <option value={50}>50 per page</option>
            </select>
            <button
              onClick={() => { setSearchQuery(''); setStartDate(null); setToothFilter('all'); setProcedureFilter('all'); setCurrentPage(1); }}
              className="px-3 py-2 border rounded-md bg-gray-50 hover:bg-gray-100"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      {/* List items */}
      {filteredTreatments().length > 0 ? (
        <div className="mt-4 space-y-4">
          {paged().map(t => (
            <div key={t.id} className="border rounded-lg bg-white p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold">{t.procedure || '—'}</h3>
                <div className="flex items-center gap-2 text-xs">
                  <span className="px-2 py-1 rounded-full bg-blue-50 text-blue-700 border">{formatDate(t.treatment_date)}</span>
                  {t.tooth_number && (<span className="px-2 py-1 rounded-full bg-yellow-50 text-yellow-700 border">Tooth #{t.tooth_number}</span>)}
                </div>
              </div>
              <div className="mt-2 text-sm text-gray-700"><span className="font-medium">Treatment Plan:</span> {t.diagnosis || '—'}</div>
              {t.notes && (<div className="mt-1 text-sm text-gray-600"><span className="font-medium">Notes:</span> {t.notes}</div>)}
              <div className="mt-1 text-xs text-gray-500">Treated by: Dr. {t.doctor?.full_name || 'Unknown'}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-gray-50 rounded-md">
          <FiFileText className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No treatment history</h3>
          <p className="mt-1 text-sm text-gray-500">This patient has no recorded treatments.</p>
        </div>
      )}

      {/* Pagination */}
      {filteredTreatments().length > itemsPerPage && (
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-600">Page {currentPage} of {totalPages}</div>
          <div className="flex gap-2">
            <button disabled={currentPage===1} onClick={()=>setCurrentPage(p=>Math.max(1,p-1))} className="px-3 py-1 border rounded disabled:opacity-50">Prev</button>
            <button disabled={currentPage===totalPages} onClick={()=>setCurrentPage(p=>Math.min(totalPages,p+1))} className="px-3 py-1 border rounded disabled:opacity-50">Next</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TreatmentHistory;


