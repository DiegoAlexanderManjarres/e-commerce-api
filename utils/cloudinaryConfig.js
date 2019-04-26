const cloudinary = require('cloudinary')


cloudinary.config({
   cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
   api_key: process.env.CLOUDINARY_API_KEY,
   api_secret: process.env.CLOUDINARY_API_SECRET,
})


const imagesToCloud = images => Promise.all(images.map(({ path }) => {
   const cloudImage = cloudinary
      .v2
      .uploader
      .upload(path, { folder: 'e_commerce/product_images' })
   return cloudImage
}))


module.exports = { cloudinary, imagesToCloud }