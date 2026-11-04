import ambulance from '@iconify-icons/lucide/ambulance';
import check from '@iconify-icons/lucide/check';
import clipboard from '@iconify-icons/lucide/clipboard';
import hospital from '@iconify-icons/lucide/hospital';
import mapPin from '@iconify-icons/lucide/map-pin';
import phone from '@iconify-icons/lucide/phone';
import star from '@iconify-icons/lucide/star';
import stethoscope from '@iconify-icons/lucide/stethoscope';
import type { ShiftIcon } from '#lib/planning.ts';

export const SHIFT_ICON_MAP = {
	check,
	hospital,
	stethoscope,
	ambulance,
	phone,
	star,
	'map-pin': mapPin,
	clipboard
} as const satisfies Record<ShiftIcon, unknown>;
