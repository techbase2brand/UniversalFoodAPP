import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, Text, Image, FlatList, Pressable, ActivityIndicator, ImageBackground, Alert, TouchableOpacity } from 'react-native';
import useShopify from '../hooks/useShopify';
import { Colors, useTheme } from '../context/Theme';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../App';
import { blackColor, redColor, whiteColor, grayColor, lightGrayOpacityColor, mediumGray } from '../constants/Color'
import { spacings, style } from '../constants/Fonts';
import { BaseStyle } from '../constants/Style';
import Header from '../components/Header'
import { widthPercentageToDP as wp, heightPercentageToDP as hp, } from '../utils';
import { logEvent } from '@amplitude/analytics-react-native';
import { getAdminAccessToken, getStoreDomain, STOREFRONT_DOMAIN, ADMINAPI_ACCESS_TOKEN, STOREFRONT_ACCESS_TOKEN, LOADER_NAME } from '../constants/Constants'
import { ShopifyProduct } from '../../@types';
import { BACKGROUND_IMAGE, WARLEY_SEARCH } from '../assests/images'
import Product from '../components/ProductVertical';
import { useCart } from '../context/Cart';
import { useSelector } from 'react-redux';
import { useFocusEffect } from '@react-navigation/native';
import axios from 'axios';
import LoaderKit from 'react-native-loader-kit';
import { useThemes } from '../context/ThemeContext';
import { lightColors, darkColors } from '../constants/Color';
import ChatButton from '../components/ChatButton';
import { scheduleNotification } from '../notifications';
const { flex, textAlign, alignItemsCenter, resizeModeContain, borderRadius10, positionRelative, alignJustifyCenter, resizeModeCover, flexDirectionRow } = BaseStyle;
type Props = NativeStackScreenProps<RootStackParamList, 'CatalogScreen'>;

function CatalogScreen({ navigation }: Props) {
  const selectedItem = useSelector((state) => state.menu.selectedItem);
  // const STOREFRONT_DOMAIN = getStoreDomain(selectedItem)
  // const ADMINAPI_ACCESS_TOKEN = getAdminAccessToken(selectedItem)
  const { colors } = useTheme();
  const styles = createStyles(colors);
  const { queries } = useShopify();
  const { addToCart, addingToCart } = useCart();
  const [fetchCollections, { data: collectionData }] = queries?.collections;
  const [products, setProducts] = useState([]);
  const [inventoryQuantities, setInventoryQuantities] = useState('');
  const [tags, setTags] = useState<string[][]>([]);
  const [options, setOptions] = useState([]);
  const [productVariantsIDS, setProductVariantsIDS] = useState([]);
  const [loading, setLoading] = useState(false)
  const [collectionTitle, setCollectionTitle] = useState('')
  const [selectedCollectionId, setSelectedCollectionId] = useState('');
  const [collectionsFetched, setCollectionsFetched] = useState(false);
  const [shopifyCollection, setShopifyCollection] = useState([])
  const { isDarkMode } = useThemes();
  const themecolors = isDarkMode ? darkColors : lightColors;
  useEffect(() => {
    logEvent('Catalog Screen Initialized');
  }, [])

  useEffect(() => {
    const fetchInitialData = async () => {
      await fetchCollections({
        variables: {
          first: 150,
        },
      });
      setCollectionsFetched(true);
    };
    fetchInitialData()
    const CollectionId = ("gid://shopify/Collection/331435278489");
    const CollectionName = ("Speakers");
    onPressCollection(CollectionId, CollectionName)
    setSelectedCollectionId(CollectionId)

  }, [fetchCollections, selectedItem]);


  useFocusEffect(
    useCallback(() => {
      if (collectionsFetched) {
        fetchProdcutCollection();
      }
    }, [collectionsFetched, selectedItem])
  );

  const fetchProdcutCollection = async () => {
    try {
      const response = await axios.post(
        `https://${STOREFRONT_DOMAIN}/api/2023-04/graphql.json`,
        {
          query: `
          {
            menu(handle: "main-menu") {
              items {
                title
                url
                type
                items {
                  title
                  id
                }
              }
            }
          }
        `,
        },
        {
          headers: {
            'X-Shopify-Storefront-Access-Token': STOREFRONT_ACCESS_TOKEN,
            'Content-Type': 'application/json',
          },
        }
      );
      const filteredItems = response.data.data.menu.items.filter(item =>
        item.title.toLowerCase() === selectedItem.toLowerCase()
      );
      filteredItems.forEach((item) => {

        let matchedCollectionsArray = [];
        item?.items?.forEach(selectedItem => {

          if (collectionData && collectionData.collections && collectionData.collections.edges) {
            let matchedCollection = collectionData.collections.edges.find(collection => {
              return collection?.node?.title === selectedItem?.title;
            });
            if (matchedCollection) {
              matchedCollectionsArray.push(matchedCollection.node);
            }
          }
        });

        setShopifyCollection(matchedCollectionsArray);
      });
    } catch (error) {
      console.log('Error fetching main menu:', error);
    }
  };

  //onPressCollection
  const onPressCollection = (id: any, title: string) => {
    logEvent(`${title} Collection Pressed from Catalog Screen`)
    setCollectionTitle(title)
    setSelectedCollectionId(id)
    setLoading(true)
    const myHeaders = new Headers();
    myHeaders.append("Content-Type", "application/json");
    myHeaders.append("X-Shopify-Access-Token", ADMINAPI_ACCESS_TOKEN);
    const graphql = JSON.stringify({
      query: `query MyQuery {
        collection(id: "${id}") {
          products(first: 10) {
            nodes {
              id
              images(first: 10) {
                nodes {
                  src
                  url
                }
              }
              title
              description
              vendor
              tags
              options(first:10){
                id
                name
                values
              }
              variants(first: 10) {
                nodes {
                  price
                  inventoryQuantity
                  id
                  title
                  image {
                    originalSrc
                  }
                }
              }
            }
          }
        }
      }`,
      variables: {}
    });
    const requestOptions = {
      method: "POST",
      headers: myHeaders,
      body: graphql,
      redirect: "follow"
    };
    fetch(`https://${STOREFRONT_DOMAIN}/admin/api/2024-04/graphql.json`, requestOptions)
      .then((response) => response.text())
      .then((result) => {
        const fetchedProducts = JSON.parse(result);
        setProducts(fetchedProducts?.data?.collection?.products.nodes);
        setLoading(false)
        const inventoryQuantities = fetchedProducts?.data?.collection?.products?.nodes?.map((productEdge) => {
          return productEdge?.variants?.nodes?.map((variants) => variants?.inventoryQuantity);
        });
        setInventoryQuantities(inventoryQuantities)
        const fetchedTags = fetchedProducts?.data?.collection?.products?.nodes.map(productEdge => productEdge.tags);
        setTags(fetchedTags);

        const fetchedOptions = fetchedProducts?.data?.collection?.products?.nodes.map(product => product.options);
        setOptions(fetchedOptions);


        const productVariantData = fetchedProducts?.data?.collection?.products?.nodes.map(productEdge => {
          return productEdge?.variants?.nodes.map(variant => ({
            id: variant?.id,
            title: variant?.title,
            inventoryQty: variant?.inventoryQuantity,
            image: variant?.image
          }));
        });
        setProductVariantsIDS(productVariantData)
      })

      .catch((error) => {
        setLoading(false)
        console.log("error", error)
      }
      );

  }

  function getVariant(node: ShopifyProduct) {
    return node?.variants?.nodes;
  }

  //Add to cart Product
  const addToCartProduct = async (variantId: any, quantity: any) => {
    logEvent(`Add To Cart Pressed variantId:${variantId} Qty:${quantity}`);
    await addToCart(variantId, quantity);
    Toast.show(`${quantity} item${quantity !== 1 ? 's' : ''} added to cart`);
    scheduleNotification()
  };

  const handleChatButtonPress = () => {
    logEvent('Chat button clicked in Catalog Screen');
    navigation.navigate("ShopifyInboxScreen")
  };

  const onPressSeacrchBar = () => {
    logEvent("Click on Search Bar");
    navigation.navigate('Search',
      { navigation: navigation })
  }
  return (
    <ImageBackground style={[flex, { backgroundColor: themecolors.whiteColor }]} source={isDarkMode ? '' : BACKGROUND_IMAGE}>
      <Header
        navigation={navigation}
        image={true}
        menuImage={true}
        notification={true}
      />
      <View style={[styles.container]}>
        <TouchableOpacity style={[styles.input, flexDirectionRow, alignItemsCenter, { backgroundColor: isDarkMode ? themecolors.grayColor : whiteColor, shadowColor: themecolors.grayColor }]} onPress={onPressSeacrchBar}>
          <Image
            source={WARLEY_SEARCH}
            style={{ width: wp(4), height: hp(5), resizeMode: 'contain', marginRight: 5 }}
          />
          <View style={[flex]}>
            <Text style={{ color: isDarkMode ? whiteColor : blackColor }}> Search...</Text>
          </View>
        </TouchableOpacity>
        <View style={[styles.productCollectionBox]}>
          <FlatList
            data={shopifyCollection}
            renderItem={({ item }) => (
              <Pressable onPress={() => onPressCollection(item?.id, item?.title)} style={{ padding: spacings.large, backgroundColor: selectedCollectionId === item?.id ? themecolors.lightPink : themecolors.whiteColor, borderWidth: 1, borderRadius: 10, marginHorizontal: 5, flexDirection: "row",borderColor:themecolors.grayColor }}>
                <Image source={{ uri: item?.image?.url }} style={[resizeModeContain, { width: 25, height: 25 }]} />
                <Text style={[styles.categoryName, textAlign, { color: themecolors.blackColor }]}>{item?.title}</Text>
              </Pressable>
            )}
            showsHorizontalScrollIndicator={false}
            keyExtractor={(index) => index.toString()}
            horizontal
          />
        </View>
        <View style={[styles.productDetailsBox, { paddingBottom: isDarkMode ? spacings.xLarge : 0 }, alignJustifyCenter]}>
          {!loading ? <>
            <FlatList
              data={products}
              renderItem={({ item, index }) => {
                return (
                  <Product
                    key={item?.id}
                    product={item}
                    onAddToCart={addToCartProduct}
                    loading={addingToCart?.has(getVariant(item)?.id ?? '')}
                    inventoryQuantity={inventoryQuantities[index]}
                    option={options[index]}
                    ids={productVariantsIDS[index]}
                    width={wp(47)}
                    height={wp(51)}
                    spaceTop={4}
                    onPress={() => {
                      navigation.navigate('ProductDetails', {
                        product: item,
                        variant: getVariant(item),
                        inventoryQuantity: inventoryQuantities[index],
                        tags: tags[index],
                        option: options[index],
                        ids: productVariantsIDS[index]
                      });
                    }}
                  />
                );
              }}
              showsVerticalScrollIndicator={false}
              keyExtractor={(item) => item?.id}
              numColumns={2}
            />
          </>
            :
            <View style={[alignJustifyCenter, { height: hp(52) }]}>
              <LoaderKit
                style={{ width: 50, height: 50 }}
                name={LOADER_NAME}
                color={themecolors.blackColor}
              />
            </View>
          }
        </View>
      </View>
      <ChatButton onPress={handleChatButtonPress} />
    </ImageBackground>

  );
}

export default CatalogScreen;

function createStyles() {
  return StyleSheet.create({
    container: {
      width: wp(100),
      height: hp(90),

      // flexDirection: "row"
    },
    productCollectionBox: {
      width: "100%",
      height: hp(5),
      paddingHorizontal: spacings.large,
      // backgroundColor: lightGrayOpacityColor
    },
    productDetailsBox: {
      width: "100%",
      height: hp(74),
      padding: spacings.large,
    },
    card: {
      width: "100%",
      height: "100%",
    },
    categoryName: {
      fontSize: style.fontSizeNormal.fontSize,
      color: blackColor,
      marginLeft: spacings.small,
      fontWeight: style.fontWeightThin1x.fontWeight,
    },
    text: {
      fontSize: style.fontSizeLarge.fontSize,
      fontWeight: style.fontWeightThin1x.fontWeight,
      color: blackColor,
    },
    drinkBannerBox: {
      width: wp(40.5),
      height: hp(20),
      margin: spacings.large,
    },
    input: {
      width: "93%",
      height: hp(6),
      borderColor: 'transparent',
      borderWidth: .1,
      borderRadius: 5,
      paddingHorizontal: spacings.large,
      marginVertical: spacings.large,
      marginHorizontal: 16,
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.75,
      shadowRadius: 10,
      elevation: 6,
      // height: 40,
    },

  });
}
