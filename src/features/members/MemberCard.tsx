import React from 'react';
import type { Member } from '@/types/domain';
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
      className="p-4 bg-white rounded-md border border-[#dfe5e4] transition-all cursor-pointer flex flex-col justify-between"
    >
      <div>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-full ${member.gender === 'male' ? 'bg-blue-100 text-blue-600' : 'bg-pink-100 text-pink-600'}`}>
              <User className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-[#17222b] text-base">
                {member.firstName} {member.lastName}
              </h3>
              <span className="text-xs text-[#5b6a73] flex items-center gap-1">
                <Shield className="w-3 h-3" />
                {getAppointmentLabel(member.appointment)}
              </span>
            </div>
          </div>
          {member.isActive ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-[#eaf8f1] text-[#2f7d5b]">
              <CheckCircle className="w-3 h-3 mr-1" /> Activo
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-600">
              <XCircle className="w-3 h-3 mr-1" /> Inactivo
            </span>
          )}
        </div>

        <div className="mt-3 space-y-1 text-xs text-[#5b6a73]">
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

      <div className="mt-4 pt-3 border-t border-[#dfe5e4] flex items-center justify-between text-xs text-[#5b6a73]">
        <span className="flex items-center gap-1">
          <Award className="w-3.5 h-3.5 text-amber-500" />
          {member.isBaptized ? 'Bautizado(a)' : 'No bautizado(a)'}
        </span>
      </div>
    </div>
  );
};
