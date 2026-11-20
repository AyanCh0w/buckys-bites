import { Image, useImage, type ImageRef } from "expo-image";
import { usePathname } from "expo-router";
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { View, type ViewStyle } from "react-native";
import { assets } from "../data/assets";
import sheet from "../data/bakery-thumbnails.json";
import { BAKERY_KEY } from "../lib/menu";
import { AssetImage } from "./ui";

const bakeryThumbnailSheet = require("../../assets/bakery-thumbnails.webp");
const tiles = new Map(sheet.keys.map((key, index) => [assets[key], index]));

// One random priority per image keeps a visit's choices stable if the menu is re-ranked.
export function makePicker() {
  const priorities = new Map(
    Object.values(assets).map((source) => [source, Math.random()]),
  );
  return (sources: (number | undefined)[], count = 1) =>
    [...new Set(sources.filter((source) => source != null))]
      .sort((a, b) => (priorities.get(a) ?? 1) - (priorities.get(b) ?? 1))
      .slice(0, count);
}

const initialPicks = { menu: makePicker(), categories: makePicker() };
const BakeryThumbnails = createContext({
  picks: initialPicks,
  image: null as ImageRef | null,
  pending: true,
});

export function BakeryThumbnailProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const previousPath = useRef(pathname);
  const [picks, setPicks] = useState(initialPicks);
  const [failed, setFailed] = useState(false);
  const image = useImage(bakeryThumbnailSheet, {
    onError: () => setFailed(true),
  });

  // Keep category covers stable when opening a bakery category and going back.
  useEffect(() => {
    const last = previousPath.current;
    previousPath.current = pathname;
    const bakeryPath = `/kitchen/${BAKERY_KEY}`;
    if (
      last === pathname ||
      (last === bakeryPath && pathname.startsWith(`${bakeryPath}/`))
    )
      return;
    const area =
      last === "/menu"
        ? "menu"
        : last === bakeryPath
          ? "categories"
          : undefined;
    if (area) {
      const next = makePicker();
      setPicks((current) => ({ ...current, [area]: next }));
    }
  }, [pathname]);

  return (
    <BakeryThumbnails.Provider
      value={{ picks, image, pending: !image && !failed }}
    >
      {children}
    </BakeryThumbnails.Provider>
  );
}

export function useBakeryThumbnails() {
  return useContext(BakeryThumbnails);
}

export function BakeryThumbnail({
  source,
  size,
  style,
  fallback,
}: {
  source?: number;
  size: number;
  style?: ViewStyle;
  fallback?: ReactNode;
}) {
  const { image } = useBakeryThumbnails();
  const tile = source == null ? undefined : tiles.get(source);
  const frame = { width: size, height: size, ...style };
  if (!image || tile == null)
    return <AssetImage source={source} style={frame} fallback={fallback} />;
  return (
    <View style={[frame, { overflow: "hidden" }]} accessible={false}>
      <Image
        source={image}
        accessible={false}
        accessibilityIgnoresInvertColors
        loading="eager"
        contentFit="fill"
        style={{
          position: "absolute",
          left: -(tile % sheet.columns) * size,
          top: -Math.floor(tile / sheet.columns) * size,
          width: sheet.columns * size,
          height: sheet.rows * size,
        }}
      />
    </View>
  );
}
