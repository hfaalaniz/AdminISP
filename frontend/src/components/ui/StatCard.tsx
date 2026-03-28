interface Props {
  label: string;
  value: string | number;
  icon: string;
  color?: string;
  sub?: string;
}

export const StatCard = ({ label, value, icon, color = 'bg-blue-50 text-blue-600', sub }: Props) => (
  <div className="bg-white rounded-xl border border-gray-200 p-5 flex items-start gap-4 shadow-sm">
    <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl ${color}`}>{icon}</div>
    <div>
      <p className="text-sm text-gray-500">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  </div>
);
