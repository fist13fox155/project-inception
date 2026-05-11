/**
 * Icon — SVG-based wrapper using lucide-react-native.
 *
 * Replaces @expo/vector-icons/Ionicons which has been chronically failing to
 * load the .ttf font over the Metro tunnel in this environment.
 *
 * Same API as Ionicons: `<Icon name="chevron-back" size={20} color="#fff" />`.
 * Names follow the Ionicons naming convention so we can drop-in replace.
 */
import React from 'react';
import {
  Plus,
  PlusCircle,
  AlertCircle,
  BarChart3,
  MessageSquare,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  X,
  FileText,
  Files,
  Globe,
  Presentation,
  LogIn,
  Flame,
  FolderOpen,
  LocateFixed,
  MapPin,
  Lock,
  LogOut,
  Map as MapIcon,
  Mic,
  PauseCircle,
  Users,
  PlayCircle,
  Radio,
  Search,
  Send,
  Settings,
  Share2,
  Shield,
  ShieldCheck,
  Sparkles,
  Clock,
  Trash2,
  Volume2,
  Volume1,
  VolumeX,
  Crosshair,
} from 'lucide-react-native';

type IconProps = {
  name: string;
  size?: number;
  color?: string;
  style?: any;
};

// Map of Ionicons names → Lucide components
const MAP: Record<string, React.ComponentType<any>> = {
  add: Plus,
  'add-circle-outline': PlusCircle,
  'alert-circle': AlertCircle,
  'bar-chart-outline': BarChart3,
  'chatbubbles-outline': MessageSquare,
  checkmark: Check,
  'checkmark-circle': CheckCircle2,
  'chevron-back': ChevronLeft,
  'chevron-forward': ChevronRight,
  close: X,
  'document-text-outline': FileText,
  'documents-outline': Files,
  'earth-outline': Globe,
  'easel-outline': Presentation,
  'enter-outline': LogIn,
  flame: Flame,
  'folder-open-outline': FolderOpen,
  globe: Globe,
  'globe-outline': Globe,
  locate: LocateFixed,
  location: MapPin,
  'lock-closed': Lock,
  'log-out-outline': LogOut,
  'map-outline': MapIcon,
  mic: Mic,
  'mic-outline': Mic,
  'pause-circle': PauseCircle,
  people: Users,
  'play-circle': PlayCircle,
  'play-circle-outline': PlayCircle,
  radio: Radio,
  'radio-outline': Radio,
  search: Search,
  send: Send,
  'settings-outline': Settings,
  'share-outline': Share2,
  'share-social': Share2,
  shield: Shield,
  'shield-checkmark': ShieldCheck,
  'shield-half': Shield,
  sparkles: Sparkles,
  'time-outline': Clock,
  'trash-outline': Trash2,
  'volume-high': Volume2,
  'volume-medium-outline': Volume1,
  'volume-mute': VolumeX,
  crosshair: Crosshair,
};

export default function Icon({ name, size = 20, color = '#fff', style }: IconProps) {
  const Cmp = MAP[name] || AlertCircle;
  return <Cmp size={size} color={color} strokeWidth={2} style={style} />;
}
