export const CONSTANTS = {
  POINTS_PER_POKE: 50,
  MIN_WITHDRAWAL: 2000,
  SIGNUP_BONUS: 500,
  REFERRER_BONUS: 300,
  DAILY_POKE_LIMITS: {
    SEND: 2,
    RECEIVE: 2
  },
  WITHDRAWAL_SCHEDULE: {
    DAYS: [1, 3, 5],
    START_HOUR: 16,
    END_HOUR: 17
  },
  AD_REQUIRED: process.env.AD_REQUIRED === 'true',
  COUPON_REQUIRED: process.env.COUPON_REQUIRED === 'true'
};

export const ROLES = {
  USER: 'user',
  ADMIN: 'admin',
  VENDOR: 'vendor'
};

export const POKE_STATUS = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  FAILED: 'failed'
};

export const WITHDRAWAL_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  PAID: 'paid'
};
