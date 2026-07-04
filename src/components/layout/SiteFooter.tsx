const cooperativeName =
  "NASUGBU FARMERS AND FISHERFOLKS AGRICULTURE COOPERATIVE";

export default function SiteFooter() {
  return (
    <footer className="border-t border-[#1F6B43]/20 bg-[#123D2A] px-5 py-10 text-white sm:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="font-bold uppercase tracking-[0.16em]">
            {cooperativeName}
          </p>
          <p className="mt-2 text-sm text-white/55">
            Agriculture and fisherfolk cooperative landing portal.
          </p>
        </div>
        <p className="text-sm text-white/55">
          Copyright 2026. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
