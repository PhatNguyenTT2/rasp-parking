import { Clock } from 'lucide-react';

function Header() {
  const currentTime = new Date().toLocaleString('vi-VN', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm">
      <div className="container mx-auto px-6 py-3">
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-800">Hệ Thống Quản Lý Bãi Giữ Xe Máy</h1>

          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Clock size={16} className="text-gray-500" />
            <span>{currentTime}</span>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Header;
