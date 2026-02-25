import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import pokeRoutes from './poke.routes';
import walletRoutes from './wallet.routes';
import adminRoutes from './admin.routes';
import notificationRoutes from './notification.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/poke', pokeRoutes);
router.use('/wallet', walletRoutes);
router.use('/admin', adminRoutes);
router.use('/notifications', notificationRoutes);

export default router;
