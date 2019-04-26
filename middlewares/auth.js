const jwt = require('jsonwebtoken')



exports.authenticate = async (req, res, next) => {
   try {      
      const authorization = req.get('Authorization')

      if (!authorization) { throw 'Not authorized'}

      let token
      const errors = [] 
      
      jwt.verify(authorization, process.env.SECRET, (error, decoded) => {
         !error ? token = decoded : errors.push(error)
      })
      if (!token) { throw 'Could not verify token'}
      req.isAuth = true
      req.userAuthenticated = req.isAuth ? { ...token } : null

      return next()
   } catch(err) {  
      req.isAuth = false
      return typeof err === 'string'? next() : next(err) 
   }
}


exports.getAuthorizedUserId = (context) => {
   try {
      // console.log('from get augorized user', context.req.session)
      const { userId } = context.req.session
      return userId ? userId : null
   } catch (err) { 
      console.err(err)
   }
}