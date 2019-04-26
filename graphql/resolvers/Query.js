const Product = require('../../models/productSchema')


const Query = {

   
   async getProducts(parent, { limit }) {
      try {
         const products = await Product.find({}).limit(limit || 0)
         if (!Array.isArray(products)) { throw new Error('Could not fetch prodcuts') }

         return products
      } catch(err) { throw err }
   },

   
   async getProduct(parent, { productId }, context) {
      try {
         if (!productId) { throw new Error('Not valid Id') }

         const product = await Product.findById(productId)
         if (!product) { throw new Error('product not found') }

         return { 
            ...product.toObject(), 
            createdAt: new Date(product.createdAt).toDateString(),
            updatedAt: new Date(product.updatedAt).toDateString()
         }

      } catch(err) { throw err }
   },


   async getCart(parent, args, context) {
      try {
         const { session, isAuth } = context.req
         const sessionType = isAuth ? 'user' : 'guest'  
         return session[sessionType] ? { ...session[sessionType] } : null
      } catch(err) { throw err }
   },

}


module.exports = Query