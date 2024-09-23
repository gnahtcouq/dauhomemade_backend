import prisma from '@/database'
import Cron from 'croner'

const autoRemoveRefreshTokenJob = () => {
  Cron('@hourly', async () => {
    try {
      await prisma.refreshToken.deleteMany({
        where: {
          expiresAt: {
            lt: new Date()
          }
        }
      })
    } catch (error) {
      console.error(error)
    }
  })
}

export default autoRemoveRefreshTokenJob
