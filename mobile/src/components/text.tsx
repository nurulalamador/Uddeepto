import { Text as RNText, TextInput as RNTextInput, StyleSheet, type TextInputProps, type TextProps } from "react-native";

// Figtree, the website's font. Each weight is its own font file on a phone, so the family follows the weight.
const families: Record<string, string> = {
  "400": "Figtree_400Regular",
  "500": "Figtree_500Medium",
  "600": "Figtree_600SemiBold",
  "700": "Figtree_700Bold",
  "800": "Figtree_800ExtraBold",
  normal: "Figtree_400Regular",
  bold: "Figtree_700Bold",
};
const family = (style: any) => {
  const flat = StyleSheet.flatten(style) || {};
  return flat.fontFamily || families[String(flat.fontWeight || "400")] || families["400"];
};
/** Fixes the weight to the family and removes fontWeight (a custom font is not synthesised twice). */
const font = (style: any) => [style, { fontFamily: family(style), fontWeight: "normal" as const }];

export function Text({ style, ...rest }: TextProps) {
  return <RNText {...rest} style={font(style)} />;
}
export function TextInput({ style, ...rest }: TextInputProps) {
  return <RNTextInput {...rest} style={font(style)} />;
}
