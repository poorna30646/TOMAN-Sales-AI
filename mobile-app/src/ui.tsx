import React from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';

export const Colors = {
  ink: '#101426',
  inkSoft: '#202846',
  canvas: '#F7F8FC',
  surface: '#FFFFFF',
  violet: '#635BFF',
  violetDeep: '#4540C9',
  violetSoft: '#EEEDFF',
  cyan: '#16B8D4',
  green: '#16B88A',
  greenSoft: '#E8F8F3',
  amber: '#F5A524',
  amberSoft: '#FFF5DE',
  rose: '#E55767',
  roseSoft: '#FFF0F3',
  muted: '#70778C',
  subtle: '#A0A7B8',
  line: '#E8EAF1',
};

type ButtonVariant = 'primary' | 'secondary' | 'dark' | 'success' | 'ghost';

interface TomanButtonProps {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  compact?: boolean;
  disabled?: boolean;
  testID?: string;
  icon?: string;
  style?: StyleProp<ViewStyle>;
}

export function TomanButton({
  label,
  onPress,
  variant = 'primary',
  compact = false,
  disabled = false,
  testID,
  icon,
  style,
}: TomanButtonProps) {
  const palette = buttonPalette[variant];

  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({pressed}) => [
        styles.button,
        compact && styles.buttonCompact,
        {backgroundColor: palette.background, opacity: disabled ? 0.45 : pressed ? 0.82 : 1},
        style,
      ]}>
      {icon ? <Text style={[styles.buttonIcon, {color: palette.text}]}>{icon}</Text> : null}
      <Text style={[styles.buttonText, compact && styles.buttonTextCompact, {color: palette.text}]}>
        {label}
      </Text>
    </Pressable>
  );
}

const buttonPalette: Record<ButtonVariant, {background: string; text: string}> = {
  primary: {background: Colors.violet, text: '#FFFFFF'},
  secondary: {background: Colors.violetSoft, text: Colors.violetDeep},
  dark: {background: Colors.ink, text: '#FFFFFF'},
  success: {background: Colors.green, text: '#FFFFFF'},
  ghost: {background: '#FFFFFF', text: Colors.ink},
};

interface PillProps {
  label: string;
  tone?: 'violet' | 'green' | 'amber' | 'rose' | 'neutral';
  style?: StyleProp<ViewStyle>;
}

export function Pill({label, tone = 'neutral', style}: PillProps) {
  const palette = pillPalette[tone];
  return (
    <View style={[styles.pill, {backgroundColor: palette.background}, style]}>
      <Text style={[styles.pillText, {color: palette.text}]}>{label}</Text>
    </View>
  );
}

const pillPalette = {
  violet: {background: Colors.violetSoft, text: Colors.violetDeep},
  green: {background: Colors.greenSoft, text: '#0E8B67'},
  amber: {background: Colors.amberSoft, text: '#A26000'},
  rose: {background: Colors.roseSoft, text: '#B6374A'},
  neutral: {background: '#F0F2F7', text: Colors.muted},
};

interface SectionTitleProps {
  eyebrow?: string;
  title: string;
  action?: string;
  onAction?: () => void;
}

export function SectionTitle({eyebrow, title, action, onAction}: SectionTitleProps) {
  return (
    <View style={styles.sectionTitleRow}>
      <View>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {action ? (
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={8}>
          <Text style={styles.sectionAction}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

interface AvatarProps {
  initials: string;
  size?: number;
  background?: string;
  textStyle?: StyleProp<TextStyle>;
}

export function Avatar({
  initials,
  size = 42,
  background = Colors.violetSoft,
  textStyle,
}: AvatarProps) {
  return (
    <View style={[styles.avatar, {width: size, height: size, borderRadius: size / 2, backgroundColor: background}]}>
      <Text style={[styles.avatarText, {fontSize: size * 0.34}, textStyle]}>{initials}</Text>
    </View>
  );
}

interface StatusDotProps {
  color?: string;
  label: string;
}

export function StatusDot({color = Colors.green, label}: StatusDotProps) {
  return (
    <View style={styles.statusDotRow}>
      <View style={[styles.statusDot, {backgroundColor: color}]} />
      <Text style={styles.statusDotText}>{label}</Text>
    </View>
  );
}

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function Card({children, style}: CardProps) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Divider() {
  return <View style={styles.divider} />;
}

interface MetricProps {
  label: string;
  value: string;
  accent?: string;
}

export function Metric({label, value, accent = Colors.ink}: MetricProps) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={[styles.metricValue, {color: accent}]}>{value}</Text>
    </View>
  );
}

export function TrendBars() {
  return (
    <View style={styles.trendBars}>
      {trendBarVariants.map((variant, index) => (
        <View
          key={'trend-' + index}
          style={[styles.trendBar, variant]}
        />
      ))}
    </View>
  );
}

const trendBarVariants = [
  {height: 18, opacity: 0.42},
  {height: 28, opacity: 0.48},
  {height: 23, opacity: 0.54},
  {height: 38, opacity: 0.6},
  {height: 31, opacity: 0.66},
  {height: 48, opacity: 0.72},
  {height: 42, opacity: 0.78},
  {height: 60, opacity: 1},
];

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    paddingHorizontal: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: Colors.violet,
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 3,
  },
  buttonCompact: {
    minHeight: 42,
    borderRadius: 13,
    paddingHorizontal: 14,
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.05,
  },
  buttonTextCompact: {
    fontSize: 13,
  },
  buttonIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  pill: {
    alignSelf: 'flex-start',
    borderRadius: 100,
    minHeight: 26,
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  pillText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
  },
  sectionTitleRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 13,
  },
  eyebrow: {
    color: Colors.violet,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.9,
    marginBottom: 3,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    color: Colors.ink,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  sectionAction: {
    color: Colors.violet,
    fontSize: 13,
    fontWeight: '800',
    paddingVertical: 4,
  },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: Colors.violetDeep,
    fontWeight: '900',
  },
  statusDotRow: {
    alignItems: 'center',
    flexDirection: 'row',
  },
  statusDot: {
    borderRadius: 10,
    height: 7,
    marginRight: 6,
    width: 7,
  },
  statusDotText: {
    color: Colors.muted,
    fontSize: 11,
    fontWeight: '700',
  },
  card: {
    backgroundColor: Colors.surface,
    borderColor: Colors.line,
    borderRadius: 20,
    borderWidth: 1,
    padding: 18,
    shadowColor: '#1B2342',
    shadowOffset: {width: 0, height: 7},
    shadowOpacity: 0.05,
    shadowRadius: 18,
    elevation: 2,
  },
  divider: {
    backgroundColor: Colors.line,
    height: 1,
    marginVertical: 14,
  },
  metric: {
    flex: 1,
  },
  metricLabel: {
    color: Colors.muted,
    fontSize: 11,
    fontWeight: '700',
    marginBottom: 5,
  },
  metricValue: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.45,
  },
  trendBars: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    height: 62,
    justifyContent: 'space-between',
    paddingTop: 2,
  },
  trendBar: {
    backgroundColor: Colors.violet,
    borderRadius: 4,
    width: 7,
  },
});
