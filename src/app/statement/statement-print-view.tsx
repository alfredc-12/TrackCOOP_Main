"use client";

import { useEffect } from "react";
import Image from "next/image";

export default function StatementPrintView({ member, deposits, purchases }: { member: any, deposits: any[], purchases: any[] }) {
  
  useEffect(() => {
    // Automatically trigger print dialog when component mounts
    const timer = setTimeout(() => {
      window.print();
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  const totalCapital = deposits.reduce((sum, item) => sum + Number(item.amount), 0);
  const totalPurchases = purchases.reduce((sum, item) => sum + Number(item.amount), 0);

  return (
    <div className="bg-white min-h-screen font-sans text-black">
      {/* Hide on screen, only show on print or look like a document */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
      `}} />

      <div className="no-print p-4 bg-gray-100 text-center border-b border-gray-300">
        <p className="text-sm text-gray-600 mb-2">This is the print preview of your Statement of Account.</p>
        <button onClick={() => window.print()} className="bg-[#123D2A] text-white px-4 py-2 rounded-lg font-bold">Print Document</button>
        <button onClick={() => window.close()} className="ml-2 bg-white text-gray-800 border border-gray-300 px-4 py-2 rounded-lg font-bold">Close</button>
      </div>

      <div className="max-w-4xl mx-auto p-12 bg-white">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b-2 border-[#123D2A] pb-6 mb-8">
          <div className="flex items-center gap-4">
            <div className="relative h-16 w-16">
              <Image src="/trackcoop-logo.svg" alt="TrackCOOP Logo" fill className="object-contain" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-[#123D2A] uppercase tracking-wider">TrackCOOP</h1>
              <p className="text-sm font-bold text-gray-500 uppercase tracking-widest">Agricultural Cooperative</p>
            </div>
          </div>
          <div className="text-right">
            <h2 className="text-xl font-bold text-gray-800">STATEMENT OF ACCOUNT</h2>
            <p className="text-sm text-gray-500">Date Generated: {new Date().toLocaleDateString()}</p>
          </div>
        </div>

        {/* Member Info */}
        <div className="mb-10 grid grid-cols-2 gap-8 bg-gray-50 p-6 rounded-xl border border-gray-200">
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Prepared For</p>
            <h3 className="text-lg font-bold text-[#173626] uppercase">{member.full_name}</h3>
            <p className="text-sm text-gray-600">{member.barangay}, {member.municipality}, {member.province}</p>
            <p className="text-sm text-gray-600">{member.contact_number || member.user_email}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Member ID</p>
            <h3 className="text-lg font-bold text-[#173626]">{member.member_code}</h3>
            <p className="text-sm text-gray-600">Member Type: <span className="font-semibold">{member.membership_type}</span></p>
            <p className="text-sm text-gray-600">Status: <span className="font-semibold">{member.official_member_status}</span></p>
          </div>
        </div>

        {/* Share Capital */}
        <div className="mb-10">
          <h4 className="text-lg font-bold text-[#123D2A] mb-4 border-b border-gray-200 pb-2">Share Capital Deposits</h4>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-100 text-xs uppercase tracking-wider text-gray-600">
                <th className="p-3 font-bold border-b border-gray-200">Date</th>
                <th className="p-3 font-bold border-b border-gray-200">Reference / Type</th>
                <th className="p-3 font-bold border-b border-gray-200 text-right">Amount (PHP)</th>
              </tr>
            </thead>
            <tbody>
              {deposits.length > 0 ? deposits.map((d, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="p-3 text-sm text-gray-800">{new Date(d.date).toLocaleDateString()}</td>
                  <td className="p-3 text-sm text-gray-600 uppercase">{d.ref || 'Capital Deposit'}</td>
                  <td className="p-3 text-sm font-bold text-[#173626] text-right">{Number(d.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={3} className="p-6 text-center text-sm text-gray-400">No share capital deposits recorded.</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-[#f8fbf9]">
                <td colSpan={2} className="p-3 text-right font-bold text-gray-600">Total Share Capital:</td>
                <td className="p-3 text-right font-bold text-[#123D2A] text-lg">PHP {totalCapital.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Store Purchases */}
        <div className="mb-10">
          <h4 className="text-lg font-bold text-[#123D2A] mb-4 border-b border-gray-200 pb-2">Coop Store Purchases</h4>
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-100 text-xs uppercase tracking-wider text-gray-600">
                <th className="p-3 font-bold border-b border-gray-200">Date</th>
                <th className="p-3 font-bold border-b border-gray-200">Receipt / Sale No.</th>
                <th className="p-3 font-bold border-b border-gray-200 text-right">Amount (PHP)</th>
              </tr>
            </thead>
            <tbody>
              {purchases.length > 0 ? purchases.map((p, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="p-3 text-sm text-gray-800">{new Date(p.date).toLocaleDateString()}</td>
                  <td className="p-3 text-sm text-gray-600 font-mono">{p.ref}</td>
                  <td className="p-3 text-sm font-bold text-gray-800 text-right">{Number(p.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={3} className="p-6 text-center text-sm text-gray-400">No store purchases recorded.</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50">
                <td colSpan={2} className="p-3 text-right font-bold text-gray-600">Total Purchases:</td>
                <td className="p-3 text-right font-bold text-gray-800 text-lg">PHP {totalPurchases.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="mt-16 text-center text-sm text-gray-400 border-t border-gray-200 pt-8">
          <p>This is a system-generated document. For inquiries, please contact the cooperative administration.</p>
          <p className="mt-1 font-bold tracking-widest uppercase">TrackCOOP Management System</p>
        </div>
      </div>
    </div>
  );
}
