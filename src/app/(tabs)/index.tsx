import { useTheme } from "../../state/ThemeProvider";
import React, { useMemo, useEffect, useState } from "react";
import { Platform, RefreshControl, View } from "react-native";
import { router } from "expo-router";
import { useApp } from "../../state/AppProvider";
import { Page, T, Tap } from "../../components/ui";
import { DailySpecials } from "../../components/DailySpecials";
import { FoodHero, FoodRow } from "../../components/Food";
import { MenuEntrance } from "../../components/MenuEntrance";
import {
  campusDate,
  currentMeal,
  dateLabel,
  ratingFor,
} from "../../lib/domain";
import { campusPicks, homeSelection } from "../../lib/home";
import { useHaptic } from "../../lib/haptics";
import { browsingCatalog } from "../../lib/menu";

import { HomeReview } from "../../components/HomeReview";
import { Avatar } from "../../components/Avatar";

export default function Home() {
  const playHaptic = useHaptic();
  const { colors, s } = useTheme();
  const {
    catalog: fullCatalog,
    data,
    userId,
    backendAvailable,
    refreshing,
    refresh,
    refreshAccount,
    notify,
    syncError,
  } = useApp();
  const catalog = useMemo(
    () => browsingCatalog(fullCatalog, data.profile.dietary),
    [fullCatalog, data.profile.dietary],
  );
  const [now, setNow] = useState(new Date());
  const [refreshingReviews, setRefreshingReviews] = useState(false);
  async function refreshHome() {
    if (Platform.OS === "android") playHaptic("release");
    setRefreshingReviews(true);
    try {
      await Promise.all([refresh(), refreshAccount()]);
    } catch {
      notify("Couldn’t refresh reviews.");
    } finally {
      setRefreshingReviews(false);
    }
  }
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);
  const { date, pick, featured, unrated } = homeSelection(
    catalog,
    data,
    userId,
    now,
  );
  const today = campusDate(now);
  const cafePicks = campusPicks(
    catalog,
    today,
    data.profile.dietary,
    data.reviews,
    userId,
    now,
  );
  const initialMeal = currentMeal(now) === "Dinner" ? "Dinner" : "Lunch";
  return (
    <Page
      title="Bucky’s Bites"
      subtitle={dateLabel(today, {
        weekday: "long",
        month: "long",
        day: "numeric",
      })}
      right={
        <Tap
          padding="none"
          highlightRadius={30}
          onPress={() => router.push("/(tabs)/me")}
          accessibilityLabel="Open your profile"
        >
          <View
            style={{
              width: 60,
              height: 60,
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Avatar value={data.profile.avatar_id} size={43} />
          </View>
        </Tap>
      }
      refreshControl={
        <RefreshControl
          refreshing={refreshing || refreshingReviews}
          onRefresh={refreshHome}
          tintColor={colors.accent}
        />
      }
    >
      <View style={[s.inset, { marginBottom: 16 }]}>
        <HomeReview featured={featured} />
      </View>
      {syncError && (
        <T style={[s.caption, s.inset, { marginTop: 12 }]}>{syncError}</T>
      )}
      <DailySpecials
        catalog={fullCatalog}
        date={today}
        preferredMeal={initialMeal}
        dietary={data.profile.dietary}
      />
      {cafePicks.length > 0 && (
        <View style={[s.inset, { marginBottom: 20 }]}>
          <T accessibilityRole="header" style={s.sectionTitle}>
            Around Campus
          </T>
          {cafePicks.map(({ food, offering, service }) => (
            <FoodRow
              key={offering.id}
              compact
              showKitchen
              food={food}
              date={today}
              offering={offering}
              meal={service.name === "All Day" ? undefined : service.name}
            />
          ))}
        </View>
      )}
      {pick && (
        <View style={s.inset}>
          <T
            accessibilityRole="header"
            style={{ fontSize: 18, fontWeight: "600", marginTop: 8 }}
          >
            Today’s Pick
          </T>
          <FoodHero food={pick.food} personalStars={pick.stars} date={date} />
        </View>
      )}
      {(backendAvailable || data.reviews.length > 0) && unrated.length > 0 && (
        <View style={[s.inset, { marginTop: 14 }]}>
          <T accessibilityRole="header" style={s.sectionTitle}>
            Dishes You Haven’t Rated
          </T>
          {unrated.map((food, index) => {
            const rating = ratingFor(data.reviews, food.food_item_id);
            return (
              <MenuEntrance key={food.food_item_id} sequence={index}>
                <FoodRow
                  food={food}
                  date={date}
                  compact
                  showKitchen
                  photoRating={rating.count ? rating.average : undefined}
                />
              </MenuEntrance>
            );
          })}
        </View>
      )}
    </Page>
  );
}
