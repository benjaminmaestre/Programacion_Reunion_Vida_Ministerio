import React from 'react';
import { Member } from '@/types/domain';
import { User, Shield, Phone, Mail, Award, CheckCircle, XCircle } from 'lucide-react';

interface MemberCardProps {
  member: Member;
  onSelect?: (member: Member) => void;
}

export const MemberCard: React.FC<MemberCardProps> = ({ member, onSelect }) => {
  const getAppointmentLabel = (app: string) => {
    switch (app) {
      case 'elder':
        return 'Anciano';
      case 'ministerial_servant':
        return 'Siervo Ministerial';
      default:
        return 'Publicador(a)';
    }
  };

  return (
    <div
      onClick={() => onSelect && onSelect(member)}
      className="p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col justify-between"
    >
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-full ${member.gender === 'male' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'}`}>
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-base">
                {member.firstName} {member.lastName}
              </h3>
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <Shield className="w-3 h-3" />
                {getAppointmentLabel(member.appointment)}
              </span>
            </div>
          </div>
          {member.isActive ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">
              <CheckCircle className="w-3 h-3 mr-1" /> Activo
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
              <XCircle className="w-3 h-3 mr-1" /> Inactivo
            </span>
          )}
        </div>

        <div className="mt-3 space-y-1 text-xs text-slate-600 dark:text-slate-400">
          {member.phone && (
            <div className="flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-slate-400" />
              <span>{member.phone}</span>
            </div>
          )}
          {member.email && (
            <div className="flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-slate-400" />
              <span>{member.email}</span>
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <Award className="w-3.5 h-3.5 text-amber-500" />
          {member.isBaptized ? 'Bautizado(a)' : 'No bautizado(a)'}
        </span>
      </div>
    </div>
  );
};
