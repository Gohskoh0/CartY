import { NextRequest, NextResponse } from 'next/server';
import {
  getOverviewStats, getMonthlyTrend, getRecentOrders, getActivityFeed, getUserGrowth,
  getAllUsers, getAllStores, getAllOrders, getRevenueData, getSubscriptionData, getAdCampaigns,
  getFinancialSummary, getSellerActivity,
} from '@/lib/data';

export async function GET(req: NextRequest) {
  const page = req.nextUrl.searchParams.get('page') ?? 'overview';

  try {
    switch (page) {
      case 'overview': {
        const [stats, trend, recentOrders, activityFeed, userGrowth, financials, sellerActivity] = await Promise.all([
          getOverviewStats(), getMonthlyTrend(), getRecentOrders(8), getActivityFeed(), getUserGrowth(), getFinancialSummary(), getSellerActivity(),
        ]);
        return NextResponse.json({ stats, trend, recentOrders, activityFeed, userGrowth, financials, sellerActivity });
      }
      case 'users': {
        const [{ data: users, count }, growth] = await Promise.all([getAllUsers(0, 500), getUserGrowth()]);
        return NextResponse.json({ users, count, growth });
      }
      case 'stores': {
        const stores = await getAllStores();
        return NextResponse.json({ stores });
      }
      case 'orders': {
        const [{ data: orders, count }, trend] = await Promise.all([getAllOrders(0, 500), getMonthlyTrend()]);
        return NextResponse.json({ orders, count, trend });
      }
      case 'revenue': {
        const [revenue, trend, financials, sellerActivity] = await Promise.all([getRevenueData(), getMonthlyTrend(), getFinancialSummary(), getSellerActivity()]);
        return NextResponse.json({ revenue, trend, financials, sellerActivity });
      }
      case 'activity': {
        const [activityFeed, sellerActivity] = await Promise.all([getActivityFeed(), getSellerActivity()]);
        return NextResponse.json({ activityFeed, sellerActivity });
      }
      case 'subscriptions': {
        const data = await getSubscriptionData();
        return NextResponse.json(data);
      }
      case 'ads': {
        const campaigns = await getAdCampaigns();
        return NextResponse.json({ campaigns });
      }
      default:
        return NextResponse.json({ error: 'Unknown page' }, { status: 400 });
    }
  } catch (err) {
    console.error('[data API]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
